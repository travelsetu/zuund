import { NEARBY_BANDS_KM, type GeoPoint, type NearbyBandKm } from '@zuund/shared';

/** Great-circle distance (haversine). */
export function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** 2 decimals ≈ 1.1 km: enough for 5/10/25 km bands, too coarse to find someone's door. */
export function roundPoint(p: GeoPoint): GeoPoint {
  return {
    latitude: Math.round(p.latitude * 100) / 100,
    longitude: Math.round(p.longitude * 100) / 100,
  };
}

/** The smallest nearby band a distance falls in, or null beyond the largest. */
export function bandFor(km: number): NearbyBandKm | null {
  return NEARBY_BANDS_KM.find((b) => km <= b) ?? null;
}

/** Latitude/longitude box around a point that contains every point within `km`. */
export function boxAround(p: GeoPoint, km: number) {
  const dLat = km / 111;
  const dLng = km / (111 * Math.max(0.1, Math.cos((p.latitude * Math.PI) / 180)));
  return {
    latitude: { gte: p.latitude - dLat, lte: p.latitude + dLat },
    longitude: { gte: p.longitude - dLng, lte: p.longitude + dLng },
  };
}
