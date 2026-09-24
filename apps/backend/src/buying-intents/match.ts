import {
  HOTEL_CATEGORIES,
  PURCHASE_TIMELINES,
  type BuyerMatchDto,
  type HotelCategory,
  type IntentLevel,
  type PurchaseTimeline,
} from '@zuund/shared';
import { bandFor, distanceKm } from '../common/geo';

/** The parts of a Buying Post a match is worked out from. */
export interface MatchPost {
  purchaseTimeline: PurchaseTimeline;
  intentLevel: IntentLevel;
  latitude: number | null;
  longitude: number | null;
  travelMonth: string | null;
  travelWeek: number | null;
  nights: number | null;
  hotelCategory: HotelCategory | null;
}

interface Factor {
  weight: number;
  /** 0–1: how well this part lines up. */
  value: number;
  /** Said when the part lines up well (value ≥ 0.6). */
  reason?: string;
}

/**
 * How well another buyer's post lines up with the viewer's, 0–100 (Elite only).
 * Explainable by design: a weighted average of a few plain facts, each with its reason;
 * nothing hidden. Same item and city are a given (that's who is listed).
 *
 * Cars and solar: timeline 40, how sure they are 30, distance 30.
 * Holidays: travel dates 25, timeline 20, how sure 20, hotel 15, nights 10, distance 10.
 * Distance counts only when both posts have a location.
 */
export function matchScore(mine: MatchPost, theirs: MatchPost): BuyerMatchDto {
  const holiday = !!(mine.travelMonth && theirs.travelMonth);
  const w = holiday
    ? { dates: 25, timeline: 20, intent: 20, hotel: 15, nights: 10, distance: 10 }
    : { dates: 0, timeline: 40, intent: 30, hotel: 0, nights: 0, distance: 30 };

  const factors: Factor[] = [timeline(mine, theirs, w.timeline), intent(theirs, w.intent, holiday)];
  const near = distance(mine, theirs, w.distance);
  if (near) factors.push(near);
  if (holiday) {
    factors.push(
      dates(mine, theirs, w.dates),
      hotel(mine, theirs, w.hotel),
      nights(mine, theirs, w.nights),
    );
  }

  const total = factors.reduce((n, f) => n + f.weight, 0);
  const score = Math.round((100 * factors.reduce((n, f) => n + f.weight * f.value, 0)) / total);
  const reasons = factors
    .filter((f) => f.reason && f.value >= 0.6)
    .sort((a, b) => b.weight * b.value - a.weight * a.value)
    .slice(0, 3)
    .map((f) => f.reason!);
  return { score, reasons };
}

function timeline(a: MatchPost, b: MatchPost, weight: number): Factor {
  const gap = Math.abs(
    PURCHASE_TIMELINES.indexOf(a.purchaseTimeline) - PURCHASE_TIMELINES.indexOf(b.purchaseTimeline),
  );
  return {
    weight,
    value: [1, 0.67, 0.33, 0][gap] ?? 0,
    reason: gap === 0 ? 'Same timeline' : 'Similar timeline',
  };
}

/** A buyer who is sure is the more useful match. */
function intent(b: MatchPost, weight: number, holiday: boolean): Factor {
  if (b.intentLevel === 'READY')
    return { weight, value: 1, reason: holiday ? 'Ready to book' : 'Ready to buy' };
  if (b.intentLevel === 'COMMITTED') return { weight, value: 0.7, reason: 'Committed' };
  return { weight, value: 0.4 };
}

function distance(a: MatchPost, b: MatchPost, weight: number): Factor | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null)
    return null;
  const band = bandFor(distanceKm(a.latitude, a.longitude, b.latitude, b.longitude));
  if (!band) return { weight, value: 0.2 };
  return { weight, value: { 5: 1, 10: 0.8, 25: 0.5 }[band], reason: `Within ${band} km` };
}

function dates(a: MatchPost, b: MatchPost, weight: number): Factor {
  if (a.travelMonth !== b.travelMonth) return { weight, value: 0 };
  const gap = Math.abs((a.travelWeek ?? 0) - (b.travelWeek ?? 0));
  if (gap === 0) return { weight, value: 1, reason: 'Same travel week' };
  return { weight, value: gap === 1 ? 0.6 : 0.4, reason: 'Same travel month' };
}

function hotel(a: MatchPost, b: MatchPost, weight: number): Factor {
  if (!a.hotelCategory || !b.hotelCategory) return { weight, value: 0 };
  const gap = Math.abs(
    HOTEL_CATEGORIES.indexOf(a.hotelCategory) - HOTEL_CATEGORIES.indexOf(b.hotelCategory),
  );
  return { weight, value: [1, 0.5][gap] ?? 0, reason: 'Same hotel category' };
}

function nights(a: MatchPost, b: MatchPost, weight: number): Factor {
  const gap = Math.abs((a.nights ?? 0) - (b.nights ?? 0));
  return {
    weight,
    value: gap === 0 ? 1 : gap <= 2 ? 0.6 : gap <= 4 ? 0.3 : 0,
    reason: gap === 0 ? 'Same number of nights' : 'Similar trip length',
  };
}
