import { ACTIVE_RECENTLY_HOURS, PLAN_LIMITS, type MyPassDto, type PassPlan } from '@zuund/shared';
import type { Prisma } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { E } from './domain.exception';

type Db = PrismaService | Prisma.TransactionClient;

/** The pass that sets a user's limits: their best ACTIVE one (Elite beats Free). */
export interface Entitlement {
  plan: PassPlan;
  passId: string;
  buyingIntentId: string;
  activatedAt: Date;
  expiresAt: Date;
}

/** Last-activity cut-off for "active recently". */
export function activeSince(now = new Date()): Date {
  return new Date(now.getTime() - ACTIVE_RECENTLY_HOURS * 3_600_000);
}

/** A user gets one Free Pass per car+city, on any of their posts, ever. */
export async function freePassUsed(
  db: Db,
  userId: string,
  carId: string,
  cityId: string,
): Promise<boolean> {
  const used = await db.buyingPass.findFirst({
    where: { userId, plan: 'FREE', status: { not: 'PENDING' }, buyingIntent: { carId, cityId } },
    select: { id: true },
  });
  return !!used;
}

export async function entitlementFor(db: Db, userId: string): Promise<Entitlement | null> {
  const passes = await db.buyingPass.findMany({
    where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() } },
    select: { id: true, plan: true, buyingIntentId: true, activatedAt: true, expiresAt: true },
  });
  const best =
    passes.filter((p) => p.plan === 'ELITE').sort(byLatestExpiry)[0] ??
    passes.sort(byLatestExpiry)[0];
  if (!best?.activatedAt || !best.expiresAt) return null;
  return {
    plan: best.plan,
    passId: best.id,
    buyingIntentId: best.buyingIntentId,
    activatedAt: best.activatedAt,
    expiresAt: best.expiresAt,
  };
}

function byLatestExpiry(a: { expiresAt: Date | null }, b: { expiresAt: Date | null }) {
  return (b.expiresAt?.getTime() ?? 0) - (a.expiresAt?.getTime() ?? 0);
}

export async function planFor(db: Db, userId: string): Promise<PassPlan | null> {
  return (await entitlementFor(db, userId))?.plan ?? null;
}

export async function requireElite(db: Db, userId: string): Promise<Entitlement> {
  const ent = await entitlementFor(db, userId);
  if (ent?.plan !== 'ELITE') throw E.ELITE_REQUIRED();
  return ent;
}

/** Open right now: accepted connections plus the user's own pending requests. */
function activeConnections(db: Db, userId: string): Promise<number> {
  return db.connection.count({
    where: {
      OR: [
        { status: 'ACCEPTED', OR: [{ requesterId: userId }, { recipientId: userId }] },
        { status: 'PENDING', requesterId: userId },
      ],
    },
  });
}

/** Accepted since the pass started. Never goes down: removing a connection doesn't undo it. */
function acceptedSince(db: Db, userId: string, since: Date): Promise<number> {
  return db.connectionAcceptance.count({ where: { userId, acceptedAt: { gte: since } } });
}

/** Sending a request opens one more connection. */
export async function assertCanRequest(db: Db, userId: string): Promise<void> {
  const limits = PLAN_LIMITS[(await planFor(db, userId)) ?? 'FREE'];
  if ((await activeConnections(db, userId)) >= limits.activeConnections)
    throw E.CONNECTION_LIMIT(limits.activeConnections);
}

/**
 * Accepting adds one accepted connection for both people. For the requester their
 * pending request becomes the accepted connection, so only their total is checked.
 */
export async function assertCanAccept(
  db: Db,
  userId: string,
  opts: { ownRequestPending: boolean },
): Promise<void> {
  const ent = await entitlementFor(db, userId);
  const limits = PLAN_LIMITS[ent?.plan ?? 'FREE'];
  if (!opts.ownRequestPending && (await activeConnections(db, userId)) >= limits.activeConnections)
    throw E.CONNECTION_LIMIT(limits.activeConnections);
  if (ent && (await acceptedSince(db, userId, ent.activatedAt)) >= limits.acceptedConnections)
    throw E.ACCEPTED_LIMIT(limits.acceptedConnections);
}

/** The history row each side gets when a connection is accepted. */
export async function recordAcceptance(
  db: Db,
  connection: { id: string; requesterId: string; recipientId: string },
  at: Date,
): Promise<void> {
  await db.connectionAcceptance.createMany({
    data: [
      {
        userId: connection.requesterId,
        otherUserId: connection.recipientId,
        connectionId: connection.id,
        acceptedAt: at,
      },
      {
        userId: connection.recipientId,
        otherUserId: connection.requesterId,
        connectionId: connection.id,
        acceptedAt: at,
      },
    ],
  });
}

/**
 * Starting a conversation with someone you're not connected with: Elite only, one
 * credit per person per pass. Messaging the same person again costs nothing.
 */
export async function spendDirectMessageCredit(
  db: Db,
  userId: string,
  recipientId: string,
): Promise<void> {
  const ent = await requireElite(db, userId);
  const already = await db.directMessageCredit.findUnique({
    where: { buyingPassId_recipientId: { buyingPassId: ent.passId, recipientId } },
  });
  if (already) return;
  const limit = PLAN_LIMITS.ELITE.directMessages;
  if ((await db.directMessageCredit.count({ where: { buyingPassId: ent.passId } })) >= limit)
    throw E.DM_CREDITS_USED(limit);
  await db.directMessageCredit
    .create({ data: { userId, buyingPassId: ent.passId, recipientId } })
    .catch((e: unknown) => {
      if ((e as { code?: string }).code !== 'P2002') throw e; // a double tap: already spent
    });
}

/** What the signed-in user's pass allows and how much of it is used. */
export async function myPass(db: Db, userId: string): Promise<MyPassDto | null> {
  const ent = await entitlementFor(db, userId);
  if (!ent) return null;
  const limits = PLAN_LIMITS[ent.plan];
  const [active, accepted, dmUsed] = await Promise.all([
    activeConnections(db, userId),
    acceptedSince(db, userId, ent.activatedAt),
    db.directMessageCredit.count({ where: { buyingPassId: ent.passId } }),
  ]);
  return {
    plan: ent.plan,
    buyingIntentId: ent.buyingIntentId,
    expiresAt: ent.expiresAt.toISOString(),
    activeConnections: active,
    activeConnectionsLimit: limits.activeConnections,
    acceptedConnections: accepted,
    acceptedConnectionsLimit: limits.acceptedConnections,
    directMessagesLeft: Math.max(0, limits.directMessages - dmUsed),
  };
}

/** Which of `userIds` hold an active Elite Pass (the 👑 next to their name). One query. */
export async function eliteUserIds(db: Db, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db.buyingPass.findMany({
    where: {
      userId: { in: [...new Set(userIds)] },
      plan: 'ELITE',
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    },
    select: { userId: true },
    distinct: ['userId'],
  });
  return new Set(rows.map((r) => r.userId));
}
