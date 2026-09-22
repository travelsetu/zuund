'use client';

import type {
  ActivityDto,
  ApiError,
  AuthResponse,
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
  CreateActivityRequest,
  CreateBuyingIntentRequest,
  CreatePollRequest,
  CreateReportRequest,
  FileDto,
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
  PurchaseTimeline,
  RegisterRequest,
  ShareFileRequest,
  SharedFileDto,
  UpdateProfileRequest,
  VerifyPaymentRequest,
} from '@zuund/shared';

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '') + '/api';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(formatMessage(status, body));
    this.name = 'ApiRequestError';
  }

  /** Stable machine-readable code from the API's error envelope, e.g. DUPLICATE_ACTIVE_POST. */
  get code(): string {
    return (
      this.body?.error?.code ??
      (this.status === 401
        ? 'UNAUTHENTICATED'
        : this.status === 403
          ? 'FORBIDDEN'
          : this.status === 404
            ? 'NOT_FOUND'
            : 'UNKNOWN')
    );
  }

  /** For VALIDATION_FAILED: [{ path, message }]. */
  get details(): unknown {
    return this.body?.error?.details;
  }
}

function formatMessage(status: number, body: ApiError | null): string {
  const msg = body?.error?.message;
  if (msg) return msg;
  if (status === 429) return 'Too many attempts, try again in a minute';
  return `Request failed with status ${status}`;
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError)
    return err.code === 'RATE_LIMITED' ? 'Too many attempts, try again in a minute' : err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  retryOnUnauthorized?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, formData, retryOnUnauthorized = true } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: formData ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && retryOnUnauthorized && (await tryRefresh())) {
    return request<T>(path, { ...options, retryOnUnauthorized: false });
  }
  if (!res.ok) {
    const parsed = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, parsed);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const api = {
  auth: {
    login: (data: LoginRequest) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: data,
        retryOnUnauthorized: false,
      }),
    register: (data: RegisterRequest) =>
      request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: data,
        retryOnUnauthorized: false,
      }),
    logout: () => request<void>('/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
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
    cars: (q: string) => request<CarDto[]>(`/cars${qs({ q, limit: 20 })}`),
    cities: () => request<CityDto[]>('/cities'),
  },
  files: {
    upload: (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return request<FileDto>('/files', { method: 'POST', formData: fd });
    },
  },
  intents: {
    list: (cursor?: string) =>
      request<Page<BuyingIntentDto>>(`/buying-intents${qs({ cursor, limit: 50 })}`),
    get: (id: string) => request<BuyingIntentDto>(`/buying-intents/${id}`),
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
