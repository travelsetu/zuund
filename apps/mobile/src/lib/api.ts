import type {
  ActivityDto,
  ApiError,
  AuthUser,
  BrandDto,
  BuyerDiscoveryDto,
  BuyerFilter,
  BuyerProfileDto,
  BuyingIntentDto,
  BuyingPassDto,
  CarDto,
  ChangePasswordRequest,
  CityDto,
  CollectiveDto,
  CollectiveMemberDto,
  ConnectionDto,
  ConversationDto,
  CountryDto,
  CreateActivityRequest,
  CreateBuyingIntentRequest,
  CreatePollRequest,
  CreateReportRequest,
  FileDto,
  GeoGuessDto,
  IntentHistoryDto,
  IntentLevel,
  LoginRequest,
  MeDto,
  MessageDto,
  NotificationDto,
  Page,
  ParticipantStatus,
  PaymentCheckoutDto,
  PaymentDto,
  PollDto,
  ProductCategory,
  PurchaseTimeline,
  RegisterRequest,
  ShareFileRequest,
  SharedFileDto,
  UpdateProfileRequest,
  VerifyPaymentRequest,
} from '@zuund/shared';
import { Platform } from 'react-native';
import { API_URL } from './config';
import { tokens } from './tokens';

const BASE = `${API_URL}/api`;

/**
 * The web build (app.zuund.com) signs in with the API's httpOnly cookies, so no
 * token is ever readable by page scripts. iOS/Android keep bearer tokens in the
 * keychain/keystore. Everything else about requests is identical.
 */
export const COOKIE_AUTH = Platform.OS === 'web';
const credentials: RequestCredentials | undefined = COOKIE_AUTH ? 'include' : undefined;

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(
      body?.error?.message ??
        (status === 429
          ? 'Too many attempts, try again in a minute'
          : `Request failed (${status})`),
    );
    this.name = 'ApiRequestError';
  }

  /** Stable code from the API's error envelope, e.g. DUPLICATE_ACTIVE_POST. */
  get code(): string {
    return this.body?.error?.code ?? (this.status === 401 ? 'UNAUTHENTICATED' : 'UNKNOWN');
  }
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof TypeError) return 'Could not reach ZUUND. Check your connection.';
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

interface TokenResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

/** Called when refresh fails, so the app can drop back to sign-in. */
let onSignedOut: () => void = () => {};
export function setSignedOutHandler(fn: () => void) {
  onSignedOut = fn;
}

let refreshing: Promise<boolean> | null = null;

async function refresh(): Promise<boolean> {
  refreshing ??= (async () => {
    if (COOKIE_AUTH) {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials }).catch(
        () => null,
      );
      return !!res?.ok;
    }
    const rt = await tokens.refresh();
    if (!rt) return false;
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rt}` },
    }).catch(() => null);
    if (!res?.ok) return false;
    const body = (await res.json()) as TokenResponse;
    await tokens.save(body.accessToken, body.refreshToken);
    return true;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

interface Options {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  auth?: boolean;
  retry?: boolean;
}

async function request<T>(path: string, opts: Options = {}): Promise<T> {
  const { method = 'GET', body, formData, auth = true, retry = true } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && tokens.access) headers.Authorization = `Bearer ${tokens.access}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && auth && retry) {
    if (await refresh()) return request<T>(path, { ...opts, retry: false });
    await tokens.clear();
    onSignedOut();
  }
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, parsed);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

/** A file picked on the device, in the shape React Native's FormData accepts. */
export interface LocalFile {
  uri: string;
  name: string;
  type: string;
  /** Web only: the browser File, which FormData needs there instead of { uri, name, type }. */
  file?: Blob;
}

export const api = {
  auth: {
    async login(data: LoginRequest) {
      if (COOKIE_AUTH) {
        await request('/auth/login', { method: 'POST', body: data, auth: false });
        return;
      }
      const r = await request<TokenResponse>('/auth/token', {
        method: 'POST',
        body: data,
        auth: false,
      });
      await tokens.save(r.accessToken, r.refreshToken);
    },
    async register(data: RegisterRequest) {
      if (COOKIE_AUTH) {
        await request('/auth/register', { method: 'POST', body: data, auth: false });
        return;
      }
      const r = await request<TokenResponse>('/auth/register/token', {
        method: 'POST',
        body: data,
        auth: false,
      });
      await tokens.save(r.accessToken, r.refreshToken);
    },
    async logout() {
      if (COOKIE_AUTH) {
        await fetch(`${BASE}/auth/logout`, { method: 'POST', credentials }).catch(() => {});
        return;
      }
      const rt = await tokens.refresh();
      if (rt)
        await fetch(`${BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${rt}` },
        }).catch(() => {});
      await tokens.clear();
    },
    changePassword: (data: ChangePasswordRequest) =>
      request<void>('/auth/change-password', { method: 'POST', body: data }),
  },
  users: {
    me: () => request<MeDto>('/users/me'),
    updateMe: (data: UpdateProfileRequest) =>
      request<MeDto>('/users/me', { method: 'PATCH', body: data }),
    profile: (id: string) => request<BuyerProfileDto>(`/users/${id}`),
  },
  catalog: {
    search: (q: string, category?: ProductCategory, brand?: string) =>
      request<CarDto[]>(`/cars${qs({ q, category, brand, limit: 50 })}`, { auth: false }),
    brands: (category: ProductCategory) =>
      request<BrandDto[]>(`/cars/brands${qs({ category })}`, { auth: false }),
    countries: () => request<CountryDto[]>('/countries', { auth: false }),
    cities: (country: string, q?: string) =>
      request<CityDto[]>(`/cities${qs({ country, q, limit: 50 })}`, { auth: false }),
    /** Country/city guessed from this device's IP: a suggestion only. */
    geo: () => request<GeoGuessDto>('/geo', { auth: false }),
  },
  files: {
    upload: (file: LocalFile) => {
      const fd = new FormData();
      // React Native's FormData takes { uri, name, type }; a browser needs the real File.
      if (file.file) fd.append('file', file.file, file.name);
      else fd.append('file', file as unknown as Blob);
      return request<FileDto>('/files', { method: 'POST', formData: fd });
    },
  },
  intents: {
    list: (cursor?: string) =>
      request<Page<BuyingIntentDto>>(`/buying-intents${qs({ cursor, limit: 50 })}`),
    get: (id: string) => request<BuyingIntentDto>(`/buying-intents/${id}`),
    history: (id: string) => request<IntentHistoryDto[]>(`/buying-intents/${id}/history`),
    create: (data: CreateBuyingIntentRequest) =>
      request<BuyingIntentDto>('/buying-intents', { method: 'POST', body: data }),
    updateTimeline: (id: string, purchaseTimeline: PurchaseTimeline) =>
      request<BuyingIntentDto>(`/buying-intents/${id}`, {
        method: 'PATCH',
        body: { purchaseTimeline },
      }),
    changeLevel: (id: string, intentLevel: IntentLevel) =>
      request<BuyingIntentDto>(`/buying-intents/${id}/intent-level`, {
        method: 'POST',
        body: { intentLevel },
      }),
    transition: (id: string, action: 'PAUSE' | 'RESUME' | 'CLOSE') =>
      request<BuyingIntentDto>(`/buying-intents/${id}/status`, {
        method: 'POST',
        body: { action },
      }),
  },
  buyers: {
    discover: (p: { carId: string; cityId: string; filter?: BuyerFilter; cursor?: string }) =>
      request<BuyerDiscoveryDto>(`/buyers${qs({ ...p, limit: 20 })}`),
  },
  connections: {
    list: (box: 'ACCEPTED' | 'INCOMING' | 'OUTGOING' | 'BLOCKED', cursor?: string) =>
      request<Page<ConnectionDto>>(`/connections${qs({ box, cursor, limit: 50 })}`),
    request: (userId: string) =>
      request<ConnectionDto>('/connections', { method: 'POST', body: { userId } }),
    accept: (id: string) => request<ConnectionDto>(`/connections/${id}/accept`, { method: 'POST' }),
    reject: (id: string) => request<ConnectionDto>(`/connections/${id}/reject`, { method: 'POST' }),
    cancel: (id: string) => request<ConnectionDto>(`/connections/${id}`, { method: 'DELETE' }),
    block: (userId: string) =>
      request<void>('/connections/block', { method: 'POST', body: { userId } }),
    unblock: (userId: string) =>
      request<void>('/connections/unblock', { method: 'POST', body: { userId } }),
  },
  conversations: {
    list: (cursor?: string) =>
      request<Page<ConversationDto>>(`/conversations${qs({ cursor, limit: 50 })}`),
    openDirect: (userId: string) =>
      request<ConversationDto>('/conversations/direct', { method: 'POST', body: { userId } }),
    get: (id: string) => request<ConversationDto>(`/conversations/${id}`),
    messages: (id: string, cursor?: string) =>
      request<Page<MessageDto>>(`/conversations/${id}/messages${qs({ cursor, limit: 30 })}`),
    send: (id: string, data: { content: string; attachmentId?: string; replyToId?: string }) =>
      request<MessageDto>(`/conversations/${id}/messages`, { method: 'POST', body: data }),
    markRead: (id: string) => request<void>(`/conversations/${id}/read`, { method: 'POST' }),
    react: (messageId: string, emoji: string) =>
      request<void>(`/messages/${messageId}/reactions`, { method: 'POST', body: { emoji } }),
    remove: (messageId: string) => request<void>(`/messages/${messageId}`, { method: 'DELETE' }),
  },
  collectives: {
    list: (p: { carId?: string; cityId?: string; mine?: boolean; cursor?: string }) =>
      request<Page<CollectiveDto>>(`/collectives${qs({ ...p, limit: 20 })}`),
    get: (id: string) => request<CollectiveDto>(`/collectives/${id}`),
    create: (buyingIntentId: string) =>
      request<CollectiveDto>('/collectives', { method: 'POST', body: { buyingIntentId } }),
    join: (id: string, buyingIntentId: string) =>
      request<CollectiveDto>(`/collectives/${id}/join`, {
        method: 'POST',
        body: { buyingIntentId },
      }),
    leave: (id: string) => request<void>(`/collectives/${id}/leave`, { method: 'POST' }),
    members: (id: string, cursor?: string) =>
      request<Page<CollectiveMemberDto>>(`/collectives/${id}/members${qs({ cursor, limit: 50 })}`),
    polls: (id: string, cursor?: string) =>
      request<Page<PollDto>>(`/collectives/${id}/polls${qs({ cursor, limit: 20 })}`),
    createPoll: (id: string, data: CreatePollRequest) =>
      request<PollDto>(`/collectives/${id}/polls`, { method: 'POST', body: data }),
    vote: (pollId: string, optionIds: string[]) =>
      request<PollDto>(`/polls/${pollId}/vote`, { method: 'POST', body: { optionIds } }),
    closePoll: (pollId: string) => request<PollDto>(`/polls/${pollId}/close`, { method: 'POST' }),
    files: (id: string, cursor?: string) =>
      request<Page<SharedFileDto>>(`/collectives/${id}/files${qs({ cursor, limit: 30 })}`),
    shareFile: (id: string, data: ShareFileRequest) =>
      request<SharedFileDto>(`/collectives/${id}/files`, { method: 'POST', body: data }),
    removeShared: (sharedFileId: string) =>
      request<void>(`/shared-files/${sharedFileId}`, { method: 'DELETE' }),
    activities: (id: string, cursor?: string) =>
      request<Page<ActivityDto>>(`/collectives/${id}/activities${qs({ cursor, limit: 30 })}`),
    createActivity: (id: string, data: CreateActivityRequest) =>
      request<ActivityDto>(`/collectives/${id}/activities`, { method: 'POST', body: data }),
    rsvp: (activityId: string, status: ParticipantStatus) =>
      request<ActivityDto>(`/activities/${activityId}/rsvp`, { method: 'POST', body: { status } }),
    cancelActivity: (activityId: string) =>
      request<ActivityDto>(`/activities/${activityId}/cancel`, { method: 'POST' }),
  },
  payments: {
    create: (data: { buyingIntentId: string; collectiveId: string; idempotencyKey: string }) =>
      request<PaymentCheckoutDto>('/payments', { method: 'POST', body: data }),
    verify: (data: VerifyPaymentRequest) =>
      request<PaymentDto>('/payments/verify', { method: 'POST', body: data }),
    get: (id: string) => request<PaymentDto>(`/payments/${id}`),
    list: () => request<Page<PaymentDto>>('/payments?limit=50'),
    passes: () => request<Page<BuyingPassDto>>('/buying-passes?limit=50'),
  },
  notifications: {
    list: (cursor?: string) =>
      request<Page<NotificationDto>>(`/notifications${qs({ cursor, limit: 30 })}`),
    unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
    markRead: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () => request<void>('/notifications/read-all', { method: 'POST' }),
  },
  reports: {
    create: (data: CreateReportRequest) =>
      request<void>('/reports', { method: 'POST', body: data }),
  },
};
