'use client';

import type { LoginRequest, MeDto, RegisterRequest } from '@zuund/shared';
import { usePathname, useRouter } from 'next/navigation';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiRequestError } from './api';

interface AuthContextValue {
  user: MeDto | null;
  loading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setUser(await api.users.me());
    } catch (err) {
      if (!(err instanceof ApiRequestError && err.status === 401)) console.error(err);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const login = useCallback(
    async (data: LoginRequest) => {
      await api.auth.login(data);
      await refresh();
    },
    [refresh],
  );
  const register = useCallback(
    async (data: RegisterRequest) => {
      await api.auth.register(data);
      await refresh();
    },
    [refresh],
  );
  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refresh }),
    [user, loading, login, register, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Renders children only when signed in; otherwise sends to /login and comes back afterwards. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, router, pathname]);
  if (loading) return <p className="muted center-text">Loading…</p>;
  if (!user) return null;
  return <>{children}</>;
}
