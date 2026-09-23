import { E } from './domain.exception';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Nothing between buyers happens until you've joined a collective: an ACTIVE membership,
 * from a free place or a paid Buying Pass (it lapses with the pass). With `scope`, the
 * membership must be in that item + city's collective (seeing its buyers); without, any
 * collective will do (connecting, messaging, profiles).
 */
export async function requireJoined(
  prisma: PrismaService,
  userId: string,
  scope?: { carId: string; cityId: string },
): Promise<void> {
  const m = await prisma.collectiveMembership.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      ...(scope ? { collective: { carId: scope.carId, cityId: scope.cityId } } : {}),
    },
    select: { id: true },
  });
  if (!m) throw E.JOIN_COLLECTIVE_FIRST();
}
