/** Prisma P2002 on the given column. */
export function isUniqueViolation(e: unknown, field: string): boolean {
  const err = e as { code?: string; meta?: { target?: unknown } };
  if (err?.code !== 'P2002') return false;
  const target = err.meta?.target;
  return Array.isArray(target)
    ? target.some((t) => String(t).includes(field))
    : String(target ?? '').includes(field);
}
