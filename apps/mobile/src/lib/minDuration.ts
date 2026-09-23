/**
 * The preloader stays up for at least this long, so a fast response doesn't
 * flash it on and off like a glitch.
 */
export const MIN_LOADER_MS = 500;

/**
 * Resolves with `promise`'s value, but not before `ms` has passed. Rejections
 * are not delayed: an error should show straight away.
 */
export function atLeast<T>(promise: Promise<T>, ms = MIN_LOADER_MS): Promise<T> {
  const wait = new Promise<void>((resolve) => setTimeout(resolve, ms));
  return Promise.all([promise, wait]).then(([value]) => value);
}
