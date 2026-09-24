import { describe, expect, it } from 'vitest';
import { matchScore, type MatchPost } from '../src/buying-intents/match';

const car = (over: Partial<MatchPost> = {}): MatchPost => ({
  purchaseTimeline: 'WITHIN_30_DAYS',
  intentLevel: 'INTERESTED',
  latitude: null,
  longitude: null,
  travelMonth: null,
  travelWeek: null,
  nights: null,
  hotelCategory: null,
  ...over,
});

describe('match score', () => {
  it('a Ready buyer on the same timeline, 3 km away, is a full match', () => {
    const mine = car({ latitude: 23.02, longitude: 72.57 });
    const theirs = car({ intentLevel: 'READY', latitude: 23.05, longitude: 72.57 });
    expect(matchScore(mine, theirs)).toEqual({
      score: 100,
      reasons: ['Same timeline', 'Ready to buy', 'Within 5 km'],
    });
  });

  it('without a location on either post, distance is left out rather than counted against', () => {
    const r = matchScore(car(), car({ intentLevel: 'COMMITTED' }));
    // (40×1 + 30×0.7) / 70
    expect(r.score).toBe(87);
    expect(r.reasons).toEqual(['Same timeline', 'Committed']);
  });

  it('holidays weigh the trip: dates, hotel and nights', () => {
    const trip = {
      travelMonth: '2026-12',
      travelWeek: 2,
      nights: 5,
      hotelCategory: 'FOUR_STAR' as const,
    };
    const same = matchScore(car(trip), car({ ...trip, intentLevel: 'READY' }));
    expect(same.score).toBe(100);
    expect(same.reasons).toEqual(['Same travel week', 'Same timeline', 'Ready to book']);
    const other = matchScore(
      car(trip),
      car({ ...trip, travelMonth: '2027-01', hotelCategory: 'BUDGET', nights: 12 }),
    );
    // Only timeline (20) and interested (20×0.4) line up out of 90.
    expect(other.score).toBe(31);
  });
});
