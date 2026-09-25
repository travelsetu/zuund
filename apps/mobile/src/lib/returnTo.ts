import { Platform } from 'react-native';

/**
 * Guests can look around (home, the picker, the Buying Post form); signing in is
 * asked for only when it's needed. What they were doing is kept here and picked
 * up again once they are signed in:
 *
 * - a link into a screen guests can't open (an email or notification link, on the web);
 * - a Buying Post filled in as a guest, created as soon as they are signed in.
 */
const LINK_KEY = 'zuund.returnTo';
const DRAFT_KEY = 'zuund.postDraft';

/** Screens a guest can open, so a link to them needs no keeping. */
const OPEN = ['/', '/search', '/posts/new', '/privacy', '/login', '/register', '/welcome'];

// Read before the router can redirect a guest away from it.
const opened =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : null;

// Phones have no sessionStorage; the app stays open while someone signs in, so memory will do.
const memory = new Map<string, string>();
const store = {
  get(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage)
        return window.sessionStorage.getItem(key);
    } catch {
      // Storage blocked: fall back to memory.
    }
    return memory.get(key) ?? null;
  },
  set(key: string, value: string | null) {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (value === null) window.sessionStorage.removeItem(key);
        else window.sessionStorage.setItem(key, value);
      }
    } catch {
      // Memory still has it.
    }
  },
};

/** Guest: remember the link the app was opened with, if guests can't open it. */
export function keepOpeningLink() {
  if (!opened) return;
  const path = opened.split('?')[0]!.replace(/\/$/, '') || '/';
  if (!OPEN.includes(path)) store.set(LINK_KEY, opened);
}

/** Open this once the person is signed in. */
export function returnAfterSignIn(path: string) {
  store.set(LINK_KEY, path);
}

/** Signed in: where to continue, once. */
export function takeReturnLink(): string | null {
  const path = store.get(LINK_KEY);
  store.set(LINK_KEY, null);
  return path;
}

/** A Buying Post filled in by a guest. Kept for this tab only. */
export function saveDraft<T>(draft: T) {
  store.set(DRAFT_KEY, JSON.stringify(draft));
}

export function takeDraft<T>(): T | null {
  const raw = store.get(DRAFT_KEY);
  store.set(DRAFT_KEY, null);
  try {
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
