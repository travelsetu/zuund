import type { PrismaService } from '../prisma/prisma.service';

export interface ConnectionRef {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'BLOCKED';
  requesterId: string;
}

/** The viewer's relationship with each of `otherIds`, keyed by the other user's id. One query. */
export async function connectionsWith(
  prisma: PrismaService,
  viewerId: string,
  otherIds: string[],
): Promise<Map<string, ConnectionRef>> {
  if (otherIds.length === 0) return new Map();
  const rows = await prisma.connection.findMany({
    where: {
      OR: [
        { requesterId: viewerId, recipientId: { in: otherIds } },
        { recipientId: viewerId, requesterId: { in: otherIds } },
      ],
    },
  });
  return new Map(
    rows.map((r) => [
      r.requesterId === viewerId ? r.recipientId : r.requesterId,
      { id: r.id, status: r.status, requesterId: r.requesterId },
    ]),
  );
}
