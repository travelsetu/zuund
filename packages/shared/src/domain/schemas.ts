import { isValidPhoneNumber, parsePhoneNumberWithError } from 'libphonenumber-js';
import { z } from 'zod';
import {
  ACTIVITY_TYPES,
  BUYER_FILTERS,
  HOLIDAY_LIMITS,
  HOTEL_CATEGORIES,
  INTENT_LEVELS,
  PARTICIPANT_STATUSES,
  PRODUCT_CATEGORIES,
  PURCHASE_TIMELINES,
  REPORT_TARGET_TYPES,
  SHARED_FILE_TYPES,
} from './enums.js';

const uuid = z.uuid();

/**
 * Mobile number in international (E.164) form, e.g. +919876543210. Clients build it from
 * a country + national number; the server re-validates it with the same rules.
 */
export const phoneSchema = z
  .string()
  .trim()
  .refine((v) => isValidPhoneNumber(v), 'Enter a valid WhatsApp number')
  .transform((v) => parsePhoneNumberWithError(v).number as string);
const trimmed = (max: number) => z.string().trim().min(1).max(max);

// ── Auth / users ──
/** The 6-digit code sent on WhatsApp. */
export const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

/**
 * POST /auth/otp: send a code to this number on WhatsApp. For `signup` and `change` a
 * number that already has an account is refused before anything is sent.
 */
export const OTP_PURPOSES = ['login', 'signup', 'change'] as const;
export const otpRequestSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(OTP_PURPOSES).default('login'),
});
export type OtpRequest = z.infer<typeof otpRequestSchema>;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/** POST /auth/otp/login (and /auth/otp/token for the phone apps). */
export const otpLoginRequestSchema = z.object({ phone: phoneSchema, code: otpCodeSchema });
export type OtpLoginRequest = z.infer<typeof otpLoginRequestSchema>;

/** Sign-up: the WhatsApp number, proved by the code sent there, is the login. No email. */
export const registerRequestSchema = z.object({
  name: trimmed(80),
  phone: phoneSchema,
  code: otpCodeSchema,
  cityId: uuid.optional(),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const updateProfileRequestSchema = z.object({
  name: trimmed(80).optional(),
  cityId: uuid.nullable().optional(),
  about: z.string().trim().max(500).nullable().optional(),
  photoFileId: uuid.nullable().optional(),
  phone: phoneSchema.optional(),
  /** Required with a new `phone`: the WhatsApp code sent to it. */
  phoneCode: otpCodeSchema.optional(),
});
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;

// ── Pagination ──
export const pageQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PageQuery = z.infer<typeof pageQuerySchema>;

// ── Catalog ──
export const carSearchQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  /** Exact brand, e.g. "Hyundai" (case-insensitive). */
  brand: z.string().trim().min(1).max(60).optional(),
  // A whole brand or trip type fits in one page (Domestic holidays are over 50).
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CarSearchQuery = z.infer<typeof carSearchQuerySchema>;

export const brandsQuerySchema = z.object({
  category: z.enum(PRODUCT_CATEGORIES).default('CAR'),
});
export type BrandsQuery = z.infer<typeof brandsQuerySchema>;

export const citiesQuerySchema = z.object({
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, 'Use a 2-letter country code')
    .transform((v) => v.toUpperCase())
    .default('IN'),
  q: z.string().trim().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type CitiesQuery = z.infer<typeof citiesQuerySchema>;

// ── Buying intents ──
/** Holiday packages: the trip. The server also checks the month is one on offer. */
export const holidayDetailsSchema = z.object({
  travelMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Choose a travel month'),
  travelWeek: z.number().int().min(1, 'Choose a week').max(4, 'Choose a week'),
  adults: z.number().int().min(1, 'At least one adult').max(HOLIDAY_LIMITS.maxAdults),
  childAges: z
    .array(z.number().int().min(0).max(HOLIDAY_LIMITS.maxChildAge, 'Children are 0–17 years'))
    .max(HOLIDAY_LIMITS.maxChildren)
    .default([]),
  nights: z.number().int().min(1).max(HOLIDAY_LIMITS.maxNights),
  hotelCategory: z.enum(HOTEL_CATEGORIES),
});
export type HolidayDetails = z.infer<typeof holidayDetailsSchema>;

export const createBuyingIntentRequestSchema = z.object({
  carId: uuid,
  cityId: uuid,
  purchaseTimeline: z.enum(PURCHASE_TIMELINES),
  intentLevel: z.enum(INTENT_LEVELS).default('INTERESTED'),
  /** Required for holiday packages, refused for anything else. */
  holiday: holidayDetailsSchema.optional(),
});
export type CreateBuyingIntentRequest = z.infer<typeof createBuyingIntentRequestSchema>;

export const updateBuyingIntentRequestSchema = z.object({
  purchaseTimeline: z.enum(PURCHASE_TIMELINES).optional(),
});
export type UpdateBuyingIntentRequest = z.infer<typeof updateBuyingIntentRequestSchema>;

export const changeIntentLevelRequestSchema = z.object({
  intentLevel: z.enum(INTENT_LEVELS),
});
export type ChangeIntentLevelRequest = z.infer<typeof changeIntentLevelRequestSchema>;

export const buyingIntentStatusActionSchema = z.object({
  action: z.enum(['PAUSE', 'RESUME', 'CLOSE']),
});
export type BuyingIntentStatusAction = z.infer<typeof buyingIntentStatusActionSchema>;

// ── Buyer discovery ──
export const buyerDiscoveryQuerySchema = pageQuerySchema.extend({
  carId: uuid,
  cityId: uuid,
  filter: z.enum(BUYER_FILTERS).default('ALL'),
});
export type BuyerDiscoveryQuery = z.infer<typeof buyerDiscoveryQuerySchema>;

// ── Connections ──
export const createConnectionRequestSchema = z.object({ userId: uuid });
export type CreateConnectionRequest = z.infer<typeof createConnectionRequestSchema>;

export const connectionsQuerySchema = pageQuerySchema.extend({
  box: z.enum(['ACCEPTED', 'INCOMING', 'OUTGOING', 'BLOCKED']).default('ACCEPTED'),
});
export type ConnectionsQuery = z.infer<typeof connectionsQuerySchema>;

// ── Messaging ──
export const openDirectConversationRequestSchema = z.object({ userId: uuid });
export type OpenDirectConversationRequest = z.infer<typeof openDirectConversationRequestSchema>;

export const sendMessageRequestSchema = z
  .object({
    content: z.string().trim().max(4000).default(''),
    attachmentId: uuid.optional(),
    replyToId: uuid.optional(),
  })
  .refine((v) => v.content.length > 0 || v.attachmentId, {
    message: 'A message needs text or an attachment',
  });
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const reactRequestSchema = z.object({ emoji: z.string().trim().min(1).max(16) });
export type ReactRequest = z.infer<typeof reactRequestSchema>;

// ── Collectives ──
export const createCollectiveRequestSchema = z.object({
  buyingIntentId: uuid,
  name: trimmed(80).optional(),
});
export type CreateCollectiveRequest = z.infer<typeof createCollectiveRequestSchema>;

export const joinCollectiveRequestSchema = z.object({ buyingIntentId: uuid });
export type JoinCollectiveRequest = z.infer<typeof joinCollectiveRequestSchema>;

export const collectivesQuerySchema = pageQuerySchema.extend({
  carId: uuid.optional(),
  cityId: uuid.optional(),
  // z.coerce.boolean() would read "false" as true.
  mine: z.stringbool().default(false),
});
export type CollectivesQuery = z.infer<typeof collectivesQuerySchema>;

export const createPollRequestSchema = z.object({
  question: trimmed(200),
  options: z.array(trimmed(80)).min(2).max(10),
  multipleChoice: z.boolean().default(false),
  allowVoteChange: z.boolean().default(false),
  expiresAt: z.iso.datetime().optional(),
});
export type CreatePollRequest = z.infer<typeof createPollRequestSchema>;

export const voteRequestSchema = z.object({ optionIds: z.array(uuid).min(1).max(10) });
export type VoteRequest = z.infer<typeof voteRequestSchema>;

export const shareFileRequestSchema = z
  .object({
    type: z.enum(SHARED_FILE_TYPES),
    title: trimmed(120),
    description: z.string().trim().max(1000).optional(),
    fileId: uuid.optional(),
    url: z.url().optional(),
  })
  .refine((v) => (v.type === 'LINK' ? !!v.url : !!v.fileId), {
    message: 'LINK needs a url; DOCUMENT and IMAGE need an uploaded fileId',
  });
export type ShareFileRequest = z.infer<typeof shareFileRequestSchema>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');
export const createActivityRequestSchema = z
  .object({
    title: trimmed(120),
    description: z.string().trim().max(2000).optional(),
    type: z.enum(ACTIVITY_TYPES),
    date: z.iso.date(),
    startTime: hhmm,
    endTime: hhmm.optional(),
    meetingLink: z.url().optional(),
    location: z.string().trim().max(200).optional(),
  })
  .refine((v) => (v.type === 'IN_PERSON' ? !!v.location : true), {
    message: 'In-person activities need a location',
  })
  .refine((v) => (v.type === 'ONLINE' ? !!v.meetingLink : true), {
    message: 'Online activities need a meeting link',
  });
export type CreateActivityRequest = z.infer<typeof createActivityRequestSchema>;

export const rsvpRequestSchema = z.object({ status: z.enum(PARTICIPANT_STATUSES) });
export type RsvpRequest = z.infer<typeof rsvpRequestSchema>;

// ── Payments ──
export const createPaymentRequestSchema = z.object({
  buyingIntentId: uuid,
  collectiveId: uuid,
  /** Client-generated; the same key never creates a second payment. */
  idempotencyKey: z.string().trim().min(8).max(100),
});
export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>;

/** Razorpay checkout returns these; the backend verifies the signature. */
export const verifyPaymentRequestSchema = z.object({
  paymentId: uuid,
  providerOrderId: z.string().min(1),
  providerPaymentId: z.string().min(1),
  providerSignature: z.string().min(1),
});
export type VerifyPaymentRequest = z.infer<typeof verifyPaymentRequestSchema>;

// ── Reports ──
export const createReportRequestSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: uuid,
  reason: trimmed(120),
  details: z.string().trim().max(2000).optional(),
});
export type CreateReportRequest = z.infer<typeof createReportRequestSchema>;

export const blockUserRequestSchema = z.object({ userId: uuid });
export type BlockUserRequest = z.infer<typeof blockUserRequestSchema>;

// ── Admin ──
export const adminUsersQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  verification: z.enum(['UNVERIFIED', 'VERIFIED']).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
});
export const adminUserActionSchema = z.object({
  action: z.enum(['VERIFY', 'UNVERIFY', 'SUSPEND', 'REACTIVATE', 'DEACTIVATE']),
  note: z.string().trim().max(500).optional(),
});
export const adminIntentsQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED']).optional(),
  carId: uuid.optional(),
  cityId: uuid.optional(),
  userId: uuid.optional(),
});
export const adminCollectivesQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['ACTIVE', 'CLOSED', 'ARCHIVED']).optional(),
  carId: uuid.optional(),
  cityId: uuid.optional(),
});
export const adminCollectiveActionSchema = z.object({
  action: z.enum(['CLOSE', 'ARCHIVE', 'REOPEN']),
  note: z.string().trim().max(500).optional(),
});
export const adminPaymentsQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED']).optional(),
  userId: uuid.optional(),
});
export const adminRefundSchema = z.object({
  /** Paise; omitted = full amount. */
  amount: z.number().int().positive().optional(),
  note: z.string().trim().max(500).optional(),
});
export const adminPassesQuerySchema = pageQuerySchema.extend({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED']).optional(),
  userId: uuid.optional(),
});
export const adminReportsQuerySchema = pageQuerySchema.extend({
  status: z.enum(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']).optional(),
  targetType: z.enum(REPORT_TARGET_TYPES).optional(),
});
export const adminReportActionSchema = z.object({
  action: z.enum(['REVIEW', 'RESOLVE', 'DISMISS']),
  note: z.string().trim().max(1000).optional(),
});
export const adminAuditQuerySchema = pageQuerySchema.extend({
  actorId: uuid.optional(),
  action: z.string().trim().max(80).optional(),
  targetType: z.string().trim().max(40).optional(),
});
