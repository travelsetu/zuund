import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { errorMessage } from './api';
import { atLeast } from './minDuration';

/**
 * Loads data when the screen gains focus (so going back shows fresh state) and
 * exposes reload/setData for optimistic updates.
 */
export function useFocusData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useRef(load);
  loadRef.current = load;

  // Only the first load waits for the preloader's minimum time; later reloads
  // (focus, pull to refresh) keep showing the current data, so they never wait.
  const loaded = useRef(false);

  const reload = useCallback(async () => {
    try {
      const next = loaded.current ? await loadRef.current() : await atLeast(loadRef.current());
      loaded.current = true;
      setData(next);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reload, ...deps]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { data, setData, error, reload, refresh, refreshing };
}
