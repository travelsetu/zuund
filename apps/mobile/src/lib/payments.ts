import { store } from './tokens';

/**
 * One idempotency key per buying post until its payment succeeds, persisted so
 * a retry after the app is killed mid-payment reuses the same payment.
 */
const keyName = (buyingIntentId: string) => `zuund.paykey.${buyingIntentId}`;

function randomId(): string {
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('');
}

export async function idempotencyKeyFor(buyingIntentId: string): Promise<string> {
  const existing = await store.get(keyName(buyingIntentId));
  if (existing) return existing;
  const fresh = `app-${buyingIntentId.slice(0, 8)}-${randomId()}`;
  await store.set(keyName(buyingIntentId), fresh);
  return fresh;
}

export function clearIdempotencyKey(buyingIntentId: string) {
  return store.del(keyName(buyingIntentId)).catch(() => {});
}
