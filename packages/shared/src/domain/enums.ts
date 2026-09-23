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
