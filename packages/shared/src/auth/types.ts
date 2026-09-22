/** The authenticated user as exposed to clients. Never includes the password hash. */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

/** Response for POST /api/auth/login, POST /api/auth/refresh and GET /api/auth/me */
export interface AuthResponse {
  user: AuthUser;
}

/** Standard error envelope produced by the backend's exception filter. */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}
