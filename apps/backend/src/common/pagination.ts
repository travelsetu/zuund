import { BadRequestException } from '@nestjs/common';
import type { Page } from '@zuund/shared';

/**
 * Keyset cursor over (createdAt DESC, id DESC). Opaque to clients.
 * Every list query fetches limit+1 rows; the extra one tells us there is a next page.
 */
export interface Cursor {
  createdAt: Date;
  id: string;
}

export function encodeCursor(c: Cursor): string {
  return Buffer.from(`${c.createdAt.toISOString()}|${c.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined): Cursor | null {
  if (!raw) return null;
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const [iso, id] = decoded.split('|');
  const createdAt = iso ? new Date(iso) : new Date(NaN);
  if (!id || Number.isNaN(createdAt.getTime())) throw new BadRequestException('Invalid cursor');
  return { createdAt, id };
}

/** Prisma `where` fragment for rows strictly after the cursor in (createdAt DESC, id DESC) order. */
export function afterCursor(c: Cursor | null): Record<string, unknown> {
  if (!c) return {};
  return {
    OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }],
  };
}

export const cursorOrder = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

/** Trims the +1 row and builds the envelope. */
export function toPage<Row extends { createdAt: Date; id: string }, Out>(
  rows: Row[],
  limit: number,
  map: (row: Row) => Out,
): Page<Out> {
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const last = slice[slice.length - 1];
  return {
    items: slice.map(map),
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  };
}
