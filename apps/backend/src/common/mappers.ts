import type {
  BuyingIntentDto,
  BuyingPassDto,
  CarDto,
  CityDto,
  FileDto,
  HolidayDetailsDto,
  HolidayTripDto,
  MeDto,
  MyPassDto,
  PaymentDto,
  PublicUserDto,
} from '@zuund/shared';
import type {
  BuyingIntent,
  BuyingPass,
  Car,
  City,
  CollectiveMembership,
  FileObject,
  Payment,
  User,
  UserProfile,
} from '../generated/prisma/client';

export type UserWithProfile = User & { profile: (UserProfile & { city: City | null }) | null };

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function toCity(c: City): CityDto {
  return { id: c.id, name: c.name, state: c.state, slug: c.slug, countryCode: c.countryCode };
}

export function toCar(c: Car): CarDto {
  return {
    id: c.id,
    category: c.category,
    segment: c.segment,
    brand: c.brand,
    model: c.model,
    displayName: c.displayName,
    slug: c.slug,
    imageUrl: c.imageUrl,
  };
}

/** Never includes email, phone or verification internals. */
/** `elite`: ids holding an active Elite Pass (`eliteUserIds`); without it nobody shows the 👑. */
export function toPublicUser(
  u: UserWithProfile,
  opts: { about?: boolean; elite?: Set<string> } = {},
): PublicUserDto {
  return {
    id: u.id,
    name: u.name,
    photoUrl: u.profile?.photoUrl ?? null,
    city: u.profile?.city ? toCity(u.profile.city) : null,
    verificationStatus: u.verificationStatus,
    elite: opts.elite?.has(u.id) ?? false,
    ...(opts.about ? { about: u.profile?.about ?? null } : {}),
  };
}

export function toMe(u: UserWithProfile, pass: MyPassDto | null): MeDto {
  return {
    ...toPublicUser(u, { about: true }),
    elite: pass?.plan === 'ELITE',
    pass,
    email: u.email,
    phone: u.phone,
    phoneVerified: !!u.phoneVerifiedAt,
    hasPassword: !!u.passwordHash,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  };
}

export function toFile(f: FileObject): FileDto {
  return {
    id: f.id,
    url: f.url,
    fileName: f.fileName,
    mimeType: f.mimeType,
    sizeBytes: f.sizeBytes,
  };
}

export function toPass(p: BuyingPass): BuyingPassDto {
  return {
    id: p.id,
    buyingIntentId: p.buyingIntentId,
    plan: p.plan,
    amount: p.amount,
    currency: p.currency,
    status: p.status,
    activatedAt: iso(p.activatedAt),
    expiresAt: iso(p.expiresAt),
    createdAt: p.createdAt.toISOString(),
  };
}

export function toPayment(p: Payment): PaymentDto {
  return {
    id: p.id,
    buyingIntentId: p.buyingIntentId,
    buyingPassId: p.buyingPassId,
    amount: p.amount,
    currency: p.currency,
    provider: p.provider,
    providerOrderId: p.providerOrderId,
    providerPaymentId: p.providerPaymentId,
    status: p.status,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type IntentWithRelations = BuyingIntent & {
  car: Car;
  city: City;
  passes: BuyingPass[];
  memberships: Array<CollectiveMembership & { buyingPass: BuyingPass | null }>;
};

/** Include clause that produces IntentWithRelations. */
export const intentInclude = {
  car: true,
  city: true,
  passes: { orderBy: { createdAt: 'desc' as const } },
  memberships: {
    where: { status: { in: ['PENDING_PAYMENT' as const, 'ACTIVE' as const] } },
    include: { buyingPass: true },
  },
};

/** `freePassAvailable`: whether this post can still start the owner's Free Pass (`freePassUsed`). */
export function toIntent(i: IntentWithRelations, freePassAvailable = false): BuyingIntentDto {
  const m = i.memberships[0] ?? null;
  // The pass covering this post's collective: its own, or the person's Elite Pass bought
  // from another post (Elite covers all their collectives).
  const covering = m?.buyingPass?.status === 'ACTIVE' ? m.buyingPass : null;
  const active = i.passes.find((p) => p.status === 'ACTIVE');
  const pass = covering ?? active ?? i.passes[0] ?? null;
  return {
    id: i.id,
    userId: i.userId,
    car: toCar(i.car),
    city: toCity(i.city),
    purchaseTimeline: i.purchaseTimeline,
    intentLevel: i.intentLevel,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    closedAt: iso(i.closedAt),
    pausedAt: iso(i.pausedAt),
    holiday: toHolidayDetails(i),
    pass: pass ? toPass(pass) : null,
    freePassAvailable,
    locationSource: i.locationSource,
    membership: m ? { id: m.id, collectiveId: m.collectiveId, status: m.status } : null,
  };
}

type HolidayColumns = Pick<
  BuyingIntent,
  'travelMonth' | 'travelWeek' | 'adults' | 'childAges' | 'nights' | 'hotelCategory'
>;

/** A holiday post's trip, for its owner (and admins). Null for cars and solar. */
export function toHolidayDetails(i: HolidayColumns): HolidayDetailsDto | null {
  if (!i.travelMonth || !i.travelWeek || !i.adults || !i.nights || !i.hotelCategory) return null;
  return {
    travelMonth: i.travelMonth,
    travelWeek: i.travelWeek,
    adults: i.adults,
    childAges: i.childAges,
    nights: i.nights,
    hotelCategory: i.hotelCategory,
  };
}

/** The same trip for other buyers: how many children travel, not how old they are. */
export function toHolidayTrip(i: HolidayColumns): HolidayTripDto | null {
  const d = toHolidayDetails(i);
  if (!d) return null;
  const { childAges, ...rest } = d;
  return { ...rest, children: childAges.length };
}
