import type {
  BuyingIntentDto,
  BuyingPassDto,
  CarDto,
  CityDto,
  IntentHistoryDto,
  PaymentDto,
  PublicUserDto,
  ReportDto,
} from './types.js';
import type {
  CollectiveStatus,
  IntentLevel,
  MembershipStatus,
  PurchaseTimeline,
  UserRole,
  UserStatus,
  VerificationStatus,
} from './enums.js';

export interface AdminUserDto {
  id: string;
  email: string;
  /** E.164; admins only. */
  phone: string | null;
  phoneVerified: boolean;
  name: string | null;
  role: UserRole;
  status: UserStatus;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
  city: CityDto | null;
  photoUrl: string | null;
  createdAt: string;
  activeIntentCount: number;
  activePassCount: number;
}

export interface AdminUserDetailDto extends AdminUserDto {
  about: string | null;
  intents: BuyingIntentDto[];
  payments: PaymentDto[];
  reportsAgainstCount: number;
}

export interface AdminIntentDto extends BuyingIntentDto {
  user: { id: string; email: string; name: string | null };
}

export interface AdminIntentDetailDto extends AdminIntentDto {
  history: IntentHistoryDto[];
  payments: PaymentDto[];
  passes: BuyingPassDto[];
}

export interface AdminCollectiveDto {
  id: string;
  name: string;
  car: CarDto;
  city: CityDto;
  creator: { id: string; email: string; name: string | null };
  status: CollectiveStatus;
  activeMemberCount: number;
  pendingMemberCount: number;
  createdAt: string;
  closedAt: string | null;
}

export interface AdminCollectiveMemberDto {
  membershipId: string;
  user: PublicUserDto & { email: string };
  status: MembershipStatus;
  intentLevel: IntentLevel;
  purchaseTimeline: PurchaseTimeline;
  buyingIntentId: string;
  buyingPassId: string | null;
  joinedAt: string | null;
  leftAt: string | null;
}

export interface AdminPaymentDto extends PaymentDto {
  user: { id: string; email: string; name: string | null };
  car: CarDto;
  city: CityDto;
  idempotencyKey: string;
  failureReason: string | null;
  refundedAmount: number | null;
  providerRefundId: string | null;
}

export interface AdminPassDto extends BuyingPassDto {
  user: { id: string; email: string; name: string | null };
  car: CarDto;
  city: CityDto;
  paymentId: string | null;
  updatedAt: string;
}

export interface AdminReportDto extends ReportDto {
  reporter: { id: string; email: string; name: string | null };
  reportedUser: { id: string; email: string; name: string | null } | null;
  /** A short human-readable excerpt of the reported thing, when it can be shown. */
  targetPreview: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
}

export interface AuditLogDto {
  id: string;
  actor: { id: string; email: string; name: string | null };
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminStatsDto {
  users: {
    total: number;
    verified: number;
    suspended: number;
    activeLast30Days: number;
    postedAtLeastOnce: number;
  };
  intents: {
    active: number;
    total: number;
    byLevel: Record<IntentLevel, number>;
    byTimeline: Record<PurchaseTimeline, number>;
    /** Top cars/cities by ACTIVE posts. */
    byCar: Array<{ car: CarDto; count: number }>;
    byCity: Array<{ city: CityDto; count: number }>;
  };
  collectives: { active: number; total: number; activeMemberships: number };
  passes: { active: number; expired: number; refunded: number };
  payments: {
    success: number;
    failed: number;
    refunded: number;
    revenuePaise: number;
    refundedPaise: number;
  };
  connections: { accepted: number; pending: number };
  messages: { total: number; conversations: number };
  polls: { total: number; votes: number };
  reports: { open: number };
}
