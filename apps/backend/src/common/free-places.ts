import type { Prisma } from '../generated/prisma/client';

/**
 * A collective's free places are held by its current members who joined free (a ₹0
 * pass). Leaving, or the pass expiring, ends the membership and opens the place again.
 * Paid members never hold one: paying only happens once every free place is taken.
 */
export function freePlaceHolders(collectiveId: string): Prisma.CollectiveMembershipWhereInput {
  return { collectiveId, status: 'ACTIVE', buyingPass: { amount: 0 } };
}
