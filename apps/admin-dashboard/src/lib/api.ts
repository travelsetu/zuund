import type { ApiError, AuthResponse, LoginRequest } from '@zuund/shared';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError | null,
  ) {
    super(formatMessage(status, body));
    this.name = 'ApiRequestError';
  }
}

function formatMessage(status: number, body: ApiError | null): string {
  if (!body) return `Request failed with status ${status}`;
  return Array.isArray(body.message) ? body.message.join('\n') : body.message;
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
};
