import { useCallback, useEffect, useRef, useState } from 'react';
import type { Page } from '@zuund/shared';
import { ApiRequestError } from './api';

/**
 * Cursor-paginated list. `fetcher` is called with the cursor; `key` changes
 * (e.g. filters) reset the list. Exposes loadMore for the button.
 */
export function usePaged<T>(
  fetcher: (cursor: string | undefined) => Promise<Page<T>>,
  key: string,
) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const gen = useRef(0);

  const load = useCallback(async (cursor: string | undefined, append: boolean) => {
    const g = ++gen.current;
    setLoading(true);
    setError(null);
    try {
      const page = await fetcherRef.current(cursor);
      if (g !== gen.current) return;
      setItems((prev) => (append ? [...prev, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (err) {
      if (g !== gen.current) return;
      setError(err instanceof ApiRequestError ? err.message : 'Could not load data');
    } finally {
      if (g === gen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(undefined, false);
  }, [key, load]);

  const loadMore = useCallback(() => {
    if (nextCursor) void load(nextCursor, true);
  }, [nextCursor, load]);

  const reload = useCallback(() => load(undefined, false), [load]);

  return { items, nextCursor, loading, error, loadMore, reload };
}
