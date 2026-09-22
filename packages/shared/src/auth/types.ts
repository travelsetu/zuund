/** The authenticated user as exposed to clients. Never includes the password hash. */
export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  role: 'USER' | 'ADMIN';
}

/** Response for POST /api/auth/login, POST /api/auth/refresh and GET /api/auth/me */
export interface AuthResponse {
  user: AuthUser;
}

/** Every API error: `{ success: false, error: { code, message, details? } }`. */
export interface ApiError {
  success: false;
  error: {
    /** Stable machine-readable code, e.g. VALIDATION_FAILED, DUPLICATE_ACTIVE_POST, BUYING_PASS_EXPIRED. */
    code: string;
    /** Safe to show to the user as-is. */
    message: string;
    /** For VALIDATION_FAILED: [{ path, message }]. */
    details?: unknown;
  };
}
