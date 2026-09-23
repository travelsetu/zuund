/** Mirrors the Prisma enums. Kept as string unions so the frontends never import Prisma. */

/** Catalog categories live in Phase 1. The catalog item type is still named Car/CarDto. */
export const PRODUCT_CATEGORIES = ['CAR', 'SOLAR', 'HOLIDAY'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];
export const PRODUCT_CATEGORY_LABELS: Record<ProductCategory, string> = {
  CAR: 'Cars',
  SOLAR: 'Solar Panels',
  HOLIDAY: 'Holiday Packages',
};

/**
 * Holiday packages (trips from India) are split by trip type, stored as the catalog
 * item's `brand`; the destination is its `model` and the region its `segment`.
 */
export const HOLIDAY_TRIP_TYPES = ['Domestic', 'International'] as const;
export type HolidayTripType = (typeof HOLIDAY_TRIP_TYPES)[number];

export const USER_ROLES = ['USER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VERIFICATION_STATUSES = ['UNVERIFIED', 'VERIFIED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PURCHASE_TIMELINES = [
  'WITHIN_7_DAYS',
  'WITHIN_15_DAYS',
  'WITHIN_30_DAYS',
  'WITHIN_60_DAYS',
] as const;
export type PurchaseTimeline = (typeof PURCHASE_TIMELINES)[number];
export const PURCHASE_TIMELINE_LABELS: Record<PurchaseTimeline, string> = {
  WITHIN_7_DAYS: 'Within 7 days',
  WITHIN_15_DAYS: 'Within 15 days',
  WITHIN_30_DAYS: 'Within 30 days',
  WITHIN_60_DAYS: 'Within 60 days',
};

export const INTENT_LEVELS = ['INTERESTED', 'COMMITTED', 'READY'] as const;
export type IntentLevel = (typeof INTENT_LEVELS)[number];
export const INTENT_LEVEL_LABELS: Record<IntentLevel, string> = {
  INTERESTED: 'Interested',
  COMMITTED: 'Committed',
  READY: 'Ready',
};

export const BUYING_INTENT_STATUSES = ['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'] as const;
export type BuyingIntentStatus = (typeof BUYING_INTENT_STATUSES)[number];

export const BUYING_PASS_STATUSES = [
  'PENDING',
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type BuyingPassStatus = (typeof BUYING_PASS_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'INITIATED',
  'PENDING',
  'SUCCESS',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const COLLECTIVE_STATUSES = ['ACTIVE', 'CLOSED', 'ARCHIVED'] as const;
export type CollectiveStatus = (typeof COLLECTIVE_STATUSES)[number];

export const MEMBERSHIP_STATUSES = [
  'PENDING_PAYMENT',
  'ACTIVE',
  'LEFT',
  'REMOVED',
  'REFUNDED',
  'EXPIRED',
] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const CONNECTION_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'BLOCKED',
] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const CONVERSATION_TYPES = ['DIRECT', 'COLLECTIVE'] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const MESSAGE_TYPES = ['TEXT', 'ATTACHMENT', 'SYSTEM'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const MESSAGE_DELIVERY_STATES = ['SENT', 'DELIVERED', 'READ'] as const;
export type MessageDeliveryState = (typeof MESSAGE_DELIVERY_STATES)[number];

export const POLL_STATUSES = ['ACTIVE', 'CLOSED'] as const;
export type PollStatus = (typeof POLL_STATUSES)[number];

export const SHARED_FILE_TYPES = ['DOCUMENT', 'IMAGE', 'LINK'] as const;
export type SharedFileType = (typeof SHARED_FILE_TYPES)[number];

export const ACTIVITY_TYPES = ['ONLINE', 'IN_PERSON', 'HYBRID'] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_STATUSES = ['SCHEDULED', 'CANCELLED', 'COMPLETED'] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number];

export const PARTICIPANT_STATUSES = ['GOING', 'NOT_GOING'] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'CONNECTION_REQUEST',
  'CONNECTION_ACCEPTED',
  'NEW_MESSAGE',
  'MENTION',
  'NEW_POLL',
  'POLL_CLOSING',
  'COLLECTIVE_INVITATION',
  'COLLECTIVE_MEMBERSHIP',
  'NEW_ACTIVITY',
  'ACTIVITY_REMINDER',
  'PAYMENT_SUCCESS',
  'PAYMENT_FAILED',
  'PASS_EXPIRING',
  'PASS_EXPIRED',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const REPORT_TARGET_TYPES = [
  'USER',
  'MESSAGE',
  'SHARED_FILE',
  'POLL',
  'COLLECTIVE',
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_STATUSES = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const BUYER_FILTERS = ['ALL', 'RECENT', 'READY', 'COMMITTED', 'INTERESTED'] as const;
export type BuyerFilter = (typeof BUYER_FILTERS)[number];

/** ₹500 in paise. The backend is the source of truth; this is for display only. */
export const BUYING_PASS_AMOUNT_PAISE = 50_000;
export const BUYING_PASS_CURRENCY = 'INR';
export const BUYING_PASS_VALIDITY_DAYS = 60;
/** Display fallback before a collective exists; the server's CollectiveDto.freePlacesLeft is authoritative. */
export const FREE_MEMBERS_PER_COLLECTIVE = 5;

/** Hotel category asked for on a holiday Buying Post. */
export const HOTEL_CATEGORIES = ['BUDGET', 'THREE_STAR', 'FOUR_STAR', 'FIVE_STAR'] as const;
export type HotelCategory = (typeof HOTEL_CATEGORIES)[number];
export const HOTEL_CATEGORY_LABELS: Record<HotelCategory, string> = {
  BUDGET: 'Budget',
  THREE_STAR: '3 Star',
  FOUR_STAR: '4 Star',
  FIVE_STAR: '5 Star',
};

/** Holiday trip limits, shared by the form and the server. */
export const HOLIDAY_LIMITS = {
  /** Travel month: the current one plus this many after it. */
  monthsAhead: 3,
  maxAdults: 20,
  maxChildren: 10,
  maxChildAge: 17,
  maxNights: 30,
} as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The travel months on offer: this month and the next three, as "2026-09". Months
 * turn over on Indian time (UTC+5:30), wherever the server or phone happens to be.
 */
export function travelMonthOptions(now: Date = new Date()): string[] {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  return Array.from({ length: HOLIDAY_LIMITS.monthsAhead + 1 }, (_, i) => {
    const d = new Date(Date.UTC(y, m + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** Weeks of a travel month: 1 = days 1–7, 2 = 8–14, 3 = 15–21, 4 = 22 to the end. */
export const TRAVEL_WEEKS = [1, 2, 3, 4] as const;
export type TravelWeek = (typeof TRAVEL_WEEKS)[number];

/** The days a week covers in a month, e.g. week 4 of Feb 2027 → [22, 28]. */
export function travelWeekDays(month: string, week: number): [number, number] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return [(week - 1) * 7 + 1, week === 4 ? last : week * 7];
}

/** "1–7 Dec" */
export function formatTravelWeek(month: string, week: number): string {
  const [from, to] = travelWeekDays(month, week);
  const m = Number(month.split('-')[1]);
  return `${from}–${to} ${MONTHS[m - 1]}`;
}

/** False for a week of the current month that is already over (Indian time). */
export function isTravelWeekOpen(month: string, week: number, now: Date = new Date()): boolean {
  const ist = new Date(now.getTime() + 330 * 60_000);
  const current = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}`;
  if (month !== current) return month > current;
  return travelWeekDays(month, week)[1] >= ist.getUTCDate();
}

/** "2026-12" → "Dec 2026". */
export function formatTravelMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return y && m ? `${MONTHS[m - 1]} ${y}` : month;
}

/** "2 adults, 1 child" */
export function formatTravellers(adults: number, children: number): string {
  const a = `${adults} ${adults === 1 ? 'adult' : 'adults'}`;
  return children ? `${a}, ${children} ${children === 1 ? 'child' : 'children'}` : a;
}

/** "15–21 Oct 2026" */
export function formatTravelDates(month: string, week: number): string {
  return `${formatTravelWeek(month, week)} ${month.split('-')[0]}`;
}

/** "15–21 Oct 2026 · 5 nights · 2 adults, 1 child · 4 Star" for lists and cards. */
export function formatTrip(t: {
  travelMonth: string;
  travelWeek: number;
  nights: number;
  adults: number;
  children: number;
  hotelCategory: HotelCategory;
}): string {
  return [
    formatTravelDates(t.travelMonth, t.travelWeek),
    `${t.nights} ${t.nights === 1 ? 'night' : 'nights'}`,
    formatTravellers(t.adults, t.children),
    HOTEL_CATEGORY_LABELS[t.hotelCategory],
  ].join(' · ');
}
