import { useEffect, useRef, useState } from 'react';

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

/** A button's spinner stays at least this long, so a quick tap still reads as "working". */
export const MIN_BUTTON_LOADING_MS = 500;

/**
 * `loading`, but once it turns on it stays on for at least `ms`. When it turns off the
 * hold starts in the same render (so the spinner never flickers off for a frame) and an
 * effect releases it once the minimum has passed.
 */
export function useMinimumLoading(loading: boolean, ms = MIN_BUTTON_LOADING_MS): boolean {
  const [prev, setPrev] = useState(loading);
  const [holding, setHolding] = useState(false);
  const startedAt = useRef(0);
  if (loading !== prev) {
    setPrev(loading);
    setHolding(!loading);
  }
  useEffect(() => {
    if (loading) startedAt.current = performance.now();
  }, [loading]);
  useEffect(() => {
    if (!holding) return;
    const left = ms - (performance.now() - startedAt.current);
    const t = setTimeout(() => setHolding(false), Math.max(0, left));
    return () => clearTimeout(t);
  }, [holding, ms]);
  return loading || holding;
}

let pressedAt = -Infinity;

/** Called by <Button> on every tap: requests it starts are held (see holdForPress). */
export function markPress(): void {
  pressedAt = performance.now();
}

/**
 * A request started by a button tap settles (resolves or rejects) no sooner than
 * MIN_BUTTON_LOADING_MS after the tap. So the spinner, and the error or success that
 * follows it, change together instead of an error flashing up under a spinner.
 */
export function holdForPress<T>(promise: Promise<T>): Promise<T> {
  const until = pressedAt + MIN_BUTTON_LOADING_MS;
  const wait = () =>
    new Promise<void>((r) => setTimeout(r, Math.max(0, until - performance.now())));
  if (until <= performance.now()) return promise;
  return promise.then(
    async (value) => {
      await wait();
      return value;
    },
    async (error: unknown) => {
      await wait();
      throw error;
    },
  );
}
