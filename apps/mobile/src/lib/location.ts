import type { GeoGuessDto, GeoPoint } from '@zuund/shared';
import * as Location from 'expo-location';
import { api } from './api';
import { geoGuess } from './geo';

/**
 * Where the buyer is, for finding buyers near them: the device's position when they
 * allow it (phone GPS, or the browser on app.zuund.com), otherwise nothing — the
 * server then falls back to the IP address. Asked only when creating a Buying Post.
 */
export async function devicePosition(): Promise<GeoPoint | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
    ]);
    const pos = fix ?? (await Location.getLastKnownPositionAsync().catch(() => null));
    return pos ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : null;
  } catch {
    // No location services, or the browser refused: the IP fallback covers it.
    return null;
  }
}

/** The city to pre-select: nearest the device when known, else the IP's guess. */
export async function suggestedCity(position: GeoPoint | null): Promise<GeoGuessDto['city']> {
  if (position) {
    const near = await api.catalog.nearest(position).catch(() => null);
    if (near?.city) return near.city;
  }
  return (await geoGuess()).city;
}
