import type { GeoGuessDto } from '@zuund/shared';
import { useEffect, useState } from 'react';
import { api } from './api';

/** One IP lookup per app session; every picker shares it. */
let pending: Promise<GeoGuessDto> | null = null;

export function geoGuess(): Promise<GeoGuessDto> {
  pending ??= api.catalog.geo().catch(() => ({ country: null, city: null }));
  return pending;
}

export function useGeoGuess(): GeoGuessDto | null {
  const [guess, setGuess] = useState<GeoGuessDto | null>(null);
  useEffect(() => {
    let alive = true;
    void geoGuess().then((g) => alive && setGuess(g));
    return () => {
      alive = false;
    };
  }, []);
  return guess;
}
