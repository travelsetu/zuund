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
import { atLeast } from './minDuration';
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
      // App start: the preloader shows for at least MIN_LOADER_MS either way.
      const restored = await atLeast(
        (async () => {
          const { refresh } = await tokens.load();
          if (!refresh && !COOKIE_AUTH) return null;
          return api.users.me().catch(() => null);
        })(),
      );
      setMe(restored);
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
