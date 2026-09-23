import type { LoginRequest, MeDto, RegisterRequest } from '@zuund/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, COOKIE_AUTH, setSignedOutHandler } from './api';
import { tokens } from './tokens';

interface AuthState {
  /** null = signed out; undefined = still restoring the session. */
  me: MeDto | null | undefined;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeDto | null | undefined>(undefined);

  const reload = useCallback(async () => {
    setMe(await api.users.me());
  }, []);

  useEffect(() => {
    setSignedOutHandler(() => setMe(null));
    (async () => {
      // Web: the session lives in httpOnly cookies we can't see, so just ask the API.
      const { refresh } = await tokens.load();
      if (!refresh && !COOKIE_AUTH) return setMe(null);
      try {
        setMe(await api.users.me());
      } catch {
        setMe(null);
      }
    })();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      me,
      reload,
      login: async (data) => {
        await api.auth.login(data);
        await reload();
      },
      register: async (data) => {
        await api.auth.register(data);
        await reload();
      },
      logout: async () => {
        await api.auth.logout();
        setMe(null);
      },
    }),
    [me, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** For screens that only render when signed in (the root layout guarantees it). */
export function useMe(): MeDto {
  const { me } = useAuth();
  if (!me) throw new Error('useMe while signed out');
  return me;
}
