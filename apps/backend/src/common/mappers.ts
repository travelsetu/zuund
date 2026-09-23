import type {
  BuyingIntentDto,
  BuyingPassDto,
  CarDto,
  CityDto,
  FileDto,
  MeDto,
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
export function toPublicUser(u: UserWithProfile, opts: { about?: boolean } = {}): PublicUserDto {
  return {
    id: u.id,
    name: u.name,
    photoUrl: u.profile?.photoUrl ?? null,
    city: u.profile?.city ? toCity(u.profile.city) : null,
    verificationStatus: u.verificationStatus,
    ...(opts.about ? { about: u.profile?.about ?? null } : {}),
  };
}

export function toMe(u: UserWithProfile): MeDto {
  return {
    ...toPublicUser(u, { about: true }),
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
  memberships: CollectiveMembership[];
};

/** Include clause that produces IntentWithRelations. */
export const intentInclude = {
  car: true,
  city: true,
  passes: { orderBy: { createdAt: 'desc' as const } },
  memberships: { where: { status: { in: ['PENDING_PAYMENT' as const, 'ACTIVE' as const] } } },
};

export function toIntent(i: IntentWithRelations): BuyingIntentDto {
  const active = i.passes.find((p) => p.status === 'ACTIVE');
  const pass = active ?? i.passes[0] ?? null;
  const m = i.memberships[0] ?? null;
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
    pass: pass ? toPass(pass) : null,
    membership: m ? { id: m.id, collectiveId: m.collectiveId, status: m.status } : null,
  };
}
