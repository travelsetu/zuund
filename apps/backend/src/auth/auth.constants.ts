export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

/** Refresh cookie is scoped to the auth routes so it is never sent with ordinary API calls. */
export const REFRESH_COOKIE_PATH = '/api/auth';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  /** Row id in refresh_tokens; lets us revoke / rotate a specific session. */
  jti: string;
  type: 'refresh';
}

/** Shape attached to `req.user` by JwtAccessGuard. */
export interface RequestUser {
  userId: string;
  email: string;
}
