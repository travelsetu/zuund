import type {
  AdminCollectiveDto,
  AdminCollectiveMemberDto,
  AdminIntentDetailDto,
  AdminIntentDto,
  AdminPassDto,
  AdminPaymentDto,
  AdminReportDto,
  AdminStatsDto,
  AdminUserDetailDto,
  AdminUserDto,
  ApiError,
  AuditLogDto,
  AuthResponse,
  CarDto,
  CityDto,
  LoginRequest,
  Page,
} from '@zuund/shared';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(formatMessage(status, body));
    this.name = 'ApiRequestError';
  }

  /** Stable code from the API envelope, e.g. VALIDATION_FAILED, FORBIDDEN, RATE_LIMITED. */
  get code(): string {
    return this.body?.error.code ?? 'UNKNOWN';
  }
}

function formatMessage(status: number, body: ApiError | null): string {
  if (!body?.error) return `Request failed with status ${status}`;
  return body.error.message;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Set false for the refresh call itself to avoid infinite loops. */
  retryOnUnauthorized?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Calls POST /auth/refresh once even if many requests 401 at the same time. */
async function tryRefresh(): Promise<boolean> {
  refreshInFlight ??= fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retryOnUnauthorized = true } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

/** Query params; empty strings and undefined are dropped so filters stay optional. */
export type Params = Record<string, string | number | boolean | undefined>;

function qs(params: Params = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '' || v === false) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body ?? {} });

export const api = {
  auth: {
    login: (data: LoginRequest) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: data,
        retryOnUnauthorized: false,
      }),
    me: () => request<AuthResponse>('/auth/me'),
    logout: () => request<void>('/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
  },
  catalog: {
    cars: (q: string) => request<CarDto[]>(`/cars${qs({ q, limit: 50 })}`),
    cities: () => request<CityDto[]>('/cities'),
  },
  admin: {
    stats: () => request<AdminStatsDto>('/admin/stats'),

    users: (p: Params) => request<Page<AdminUserDto>>(`/admin/users${qs(p)}`),
    user: (id: string) => request<AdminUserDetailDto>(`/admin/users/${id}`),
    userAction: (id: string, action: string, note?: string) =>
      post<AdminUserDetailDto>(`/admin/users/${id}/action`, { action, note: note || undefined }),

    intents: (p: Params) => request<Page<AdminIntentDto>>(`/admin/buying-intents${qs(p)}`),
    intent: (id: string) => request<AdminIntentDetailDto>(`/admin/buying-intents/${id}`),
    closeIntent: (id: string, note?: string) =>
      post<AdminIntentDetailDto>(`/admin/buying-intents/${id}/close`, { note: note || undefined }),

    collectives: (p: Params) => request<Page<AdminCollectiveDto>>(`/admin/collectives${qs(p)}`),
    collective: (id: string) =>
      request<AdminCollectiveDto & { members: AdminCollectiveMemberDto[] }>(
        `/admin/collectives/${id}`,
      ),
    collectiveAction: (id: string, action: string, note?: string) =>
      post<AdminCollectiveDto & { members: AdminCollectiveMemberDto[] }>(
        `/admin/collectives/${id}/action`,
        {
          action,
          note: note || undefined,
        },
      ),

    payments: (p: Params) => request<Page<AdminPaymentDto>>(`/admin/payments${qs(p)}`),
    payment: (id: string) => request<AdminPaymentDto>(`/admin/payments/${id}`),
    refund: (id: string, amount?: number, note?: string) =>
      post<AdminPaymentDto>(`/admin/payments/${id}/refund`, { amount, note: note || undefined }),

    passes: (p: Params) => request<Page<AdminPassDto>>(`/admin/buying-passes${qs(p)}`),

    reports: (p: Params) => request<Page<AdminReportDto>>(`/admin/reports${qs(p)}`),
    reportAction: (id: string, action: string, note?: string) =>
      post<void>(`/admin/reports/${id}/action`, { action, note: note || undefined }),

    auditLogs: (p: Params) => request<Page<AuditLogDto>>(`/admin/audit-logs${qs(p)}`),
  },
};
