import { Platform } from 'react-native';

/**
 * Links into the app from zuund.com's category pages ("I'm buying a Creta") open
 * /search or /posts/new. Signed out, those screens aren't available yet, so the
 * link is kept for this browser tab and opened once the person has signed in or up.
 */
const KEY = 'zuund.returnTo';
const KEPT = ['/search', '/posts/new'];

// Read before the router can redirect a signed-out visitor away from it.
const opened =
  Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : null;

const storage = () => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

/** Signed out: remember the link the app was opened with, if it is one worth returning to. */
export function keepOpeningLink() {
  if (!opened || !KEPT.some((p) => opened === p || opened.startsWith(`${p}?`))) return;
  try {
    storage()?.setItem(KEY, opened);
  } catch {
    // Private mode or storage blocked: the person simply lands on the home screen.
  }
}

/** Signed in: the remembered link, once. */
export function takeOpeningLink(): string | null {
  try {
    const s = storage();
    const path = s?.getItem(KEY) ?? null;
    s?.removeItem(KEY);
    return path;
  } catch {
    return null;
  }
}
