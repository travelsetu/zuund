import type {
  ActivityStatus,
  BuyerFilter,
  ActivityType,
  BuyingIntentStatus,
  BuyingPassStatus,
  CollectiveStatus,
  ConnectionStatus,
  ConversationType,
  IntentLevel,
  MembershipStatus,
  MessageDeliveryState,
  MessageType,
  NotificationType,
  ParticipantStatus,
  PaymentStatus,
  PollStatus,
  ProductCategory,
  PurchaseTimeline,
  ReportStatus,
  ReportTargetType,
  SharedFileType,
  UserRole,
  UserStatus,
  VerificationStatus,
} from './enums.js';

/** Cursor pagination envelope used by every list endpoint. */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** A catalog brand with how many active models/systems it has. */
export interface BrandDto {
  name: string;
  count: number;
}

export interface CountryDto {
  /** ISO 3166-1 alpha-2, e.g. IN, AE, US. */
  code: string;
  name: string;
}

export interface CityDto {
  id: string;
  name: string;
  state: string;
  slug: string;
  countryCode: string;
}

/** Best guess from the request's IP. A suggestion to pre-select, never saved without the user. */
export interface GeoGuessDto {
  country: CountryDto | null;
  /** Null when the IP only resolves to a country, or to a town smaller than our city list. */
  city: CityDto | null;
}

/** A catalog item: a car model, a rooftop solar system or a holiday destination (see `category`). */
export interface CarDto {
  id: string;
  category: ProductCategory;
  /** "SUV", "Sedan", "On-grid rooftop"… */
  segment: string | null;
  brand: string;
  model: string;
  displayName: string;
  slug: string;
  imageUrl: string | null;
}

/** What one user may see of another. Never carries email or phone. */
export interface PublicUserDto {
  id: string;
  name: string | null;
  photoUrl: string | null;
  city: CityDto | null;
  verificationStatus: VerificationStatus;
  about?: string | null;
}

/** The signed-in user's own view of themselves. */
export interface MeDto extends PublicUserDto {
  /** Only older accounts and admins have one; sign-up is by WhatsApp number. */
  email: string | null;
  /** E.164, e.g. +919876543210. Null only for accounts created before mobile numbers were required. */
  phone: string | null;
  phoneVerified: boolean;
  /** Only older accounts have one; everyone else signs in with a WhatsApp code. */
  hasPassword: boolean;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface BuyingPassDto {
  id: string;
  buyingIntentId: string;
  amount: number;
  currency: string;
  status: BuyingPassStatus;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface BuyingIntentDto {
  id: string;
  userId: string;
  car: CarDto;
  city: CityDto;
  purchaseTimeline: PurchaseTimeline;
  intentLevel: IntentLevel;
  status: BuyingIntentStatus;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  pausedAt: string | null;
  /** The ACTIVE pass if there is one, otherwise the most recent, otherwise null. */
  pass: BuyingPassDto | null;
  /** Live membership for this intent, if any. */
  membership: { id: string; collectiveId: string; status: MembershipStatus } | null;
}

export interface IntentHistoryDto {
  id: string;
  previousLevel: IntentLevel | null;
  newLevel: IntentLevel;
  changedAt: string;
  changedById: string;
}

/** A buyer card in discovery. */
export interface BuyerDto {
  buyingIntentId: string;
  user: PublicUserDto;
  car: CarDto;
  city: CityDto;
  purchaseTimeline: PurchaseTimeline;
  intentLevel: IntentLevel;
  createdAt: string;
  /** The viewer's relationship with this buyer, if any. */
  connection: { id: string; status: ConnectionStatus; requesterId: string } | null;
}

export interface BuyerDiscoveryDto extends Page<BuyerDto> {
  car: CarDto;
  city: CityDto;
  /** Active buyers for this car+city, excluding the viewer. A count, not a score. */
  totalActiveBuyers: number;
  /** The same count broken down per filter pill. Counts, never scores. */
  counts: Record<BuyerFilter, number>;
}

export interface BuyerProfileDto {
  user: PublicUserDto;
  activeIntents: Array<{
    id: string;
    car: CarDto;
    city: CityDto;
    purchaseTimeline: PurchaseTimeline;
    intentLevel: IntentLevel;
  }>;
  connection: { id: string; status: ConnectionStatus; requesterId: string } | null;
  connectionCount: number;
  collectiveCount: number;
}

export interface ConnectionDto {
  id: string;
  requesterId: string;
  recipientId: string;
  status: ConnectionStatus;
  otherUser: PublicUserDto;
  createdAt: string;
  acceptedAt: string | null;
}

export interface FileDto {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MessageDto {
  id: string;
  conversationId: string;
  sender: PublicUserDto;
  messageType: MessageType;
  content: string;
  replyToId: string | null;
  attachment: FileDto | null;
  reactions: Array<{ emoji: string; count: number; reacted: boolean }>;
  /** Delivery state from the sender's point of view. */
  deliveryState: MessageDeliveryState;
  createdAt: string;
  deletedAt: string | null;
}

export interface ConversationDto {
  id: string;
  type: ConversationType;
  collectiveId: string | null;
  /** For DIRECT conversations, the other member. */
  otherUser: PublicUserDto | null;
  lastMessage: MessageDto | null;
  unreadCount: number;
  updatedAt: string;
}

export interface CollectiveDto {
  id: string;
  name: string;
  car: CarDto;
  city: CityDto;
  creatorId: string;
  status: CollectiveStatus;
  activeMemberCount: number;
  /** Free places still open (the first members join free; places never refill). 0 = ₹500 Buying Pass. */
  freePlacesLeft: number;
  createdAt: string;
  closedAt: string | null;
  /** The viewer's live membership, if any. */
  membership: { id: string; status: MembershipStatus; buyingIntentId: string } | null;
  conversationId: string | null;
}

export interface CollectiveMemberDto {
  membershipId: string;
  user: PublicUserDto;
  intentLevel: IntentLevel;
  purchaseTimeline: PurchaseTimeline;
  status: MembershipStatus;
  joinedAt: string | null;
  /** The viewer's relationship with this member; null for the viewer themselves. */
  connection: { id: string; status: ConnectionStatus; requesterId: string } | null;
}

export interface PollOptionDto {
  id: string;
  label: string;
  sortOrder: number;
  voteCount: number;
  /** Whether the viewer voted for this option. */
  voted: boolean;
}

export interface PollDto {
  id: string;
  collectiveId: string;
  creator: PublicUserDto;
  question: string;
  multipleChoice: boolean;
  allowVoteChange: boolean;
  status: PollStatus;
  expiresAt: string | null;
  closedAt: string | null;
  createdAt: string;
  options: PollOptionDto[];
  totalVotes: number;
}

export interface SharedFileDto {
  id: string;
  collectiveId: string;
  sharer: PublicUserDto;
  type: SharedFileType;
  title: string;
  description: string | null;
  file: FileDto | null;
  url: string | null;
  createdAt: string;
}

export interface ActivityDto {
  id: string;
  collectiveId: string;
  creator: PublicUserDto;
  title: string;
  description: string | null;
  type: ActivityType;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  startTime: string;
  endTime: string | null;
  meetingLink: string | null;
  location: string | null;
  status: ActivityStatus;
  goingCount: number;
  /** The viewer's RSVP, if any. */
  myStatus: ParticipantStatus | null;
  createdAt: string;
}

export interface PaymentDto {
  id: string;
  buyingIntentId: string;
  buyingPassId: string | null;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

/** What the client needs to open the provider's checkout. */
export interface PaymentCheckoutDto {
  payment: PaymentDto;
  provider: string;
  /** Razorpay: key_id + order_id. Mock: nothing else. */
  checkout: Record<string, string>;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface ReportDto {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reportedUserId: string | null;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
}
