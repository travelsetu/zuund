import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS = 'zuund.access';
const REFRESH = 'zuund.refresh';

/**
 * Keychain/keystore on devices. The web target (used only for development
 * previews) has no secure store, so it falls back to localStorage.
 */
export const store =
  Platform.OS === 'web'
    ? {
        get: async (k: string) => globalThis.localStorage?.getItem(k) ?? null,
        set: async (k: string, v: string) => globalThis.localStorage?.setItem(k, v),
        del: async (k: string) => globalThis.localStorage?.removeItem(k),
      }
    : {
        get: SecureStore.getItemAsync,
        set: SecureStore.setItemAsync,
        del: SecureStore.deleteItemAsync,
      };

/** The access token is also cached in memory for requests. */
let access: string | null = null;

export const tokens = {
  get access() {
    return access;
  },
  async load(): Promise<{ access: string | null; refresh: string | null }> {
    const [a, r] = await Promise.all([store.get(ACCESS), store.get(REFRESH)]);
    access = a;
    return { access: a, refresh: r };
  },
  refresh: () => store.get(REFRESH),
  async save(a: string, r: string) {
    access = a;
    await Promise.all([store.set(ACCESS, a), store.set(REFRESH, r)]);
  },
  async clear() {
    access = null;
    await Promise.all([store.del(ACCESS), store.del(REFRESH)]);
  },
};
