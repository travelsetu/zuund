'use client';

import type { BuyingIntentDto, CollectiveDto } from '@zuund/shared';
import Link from 'next/link';
import { PassStatus } from './PassStatus';

/**
 * The collective panel on a buying post. Payment itself lives on
 * /posts/[id]/pay so each state (pay, success, failed) is its own screen.
 */
export function PassPanel({
  intent,
  collective,
}: {
  intent: BuyingIntentDto;
  collective: CollectiveDto | null | undefined;
}) {
  const pass = intent.pass;
  const membership = intent.membership;
  if (intent.status !== 'ACTIVE' && !pass) return null;

  return (
    <div className="card stack">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Collective</h2>
        {collective && (
          <span className="small muted">
            {collective.activeMemberCount} active{' '}
            {collective.activeMemberCount === 1 ? 'member' : 'members'}
          </span>
        )}
      </div>
      {collective === undefined ? (
        <p className="muted small">Loading…</p>
      ) : collective ? (
        <p>
          <strong>{collective.name}</strong>
          <br />
          <span className="small muted">
            Buyers of {collective.car.displayName} in {collective.city.name} coordinating together.
          </span>
        </p>
      ) : (
        <p className="small muted">
          No collective for {intent.car.displayName} in {intent.city.name} yet. Start one and other
          buyers can join.
        </p>
      )}

      <PassStatus intent={intent} />

      {membership?.status === 'ACTIVE' && collective ? (
        <Link href={`/collectives/${collective.id}`} className="btn">
          Open collective
        </Link>
      ) : intent.status === 'ACTIVE' && pass?.status !== 'ACTIVE' ? (
        <>
          <p className="small muted">
            A ₹500 Buying Pass unlocks the collective for this buying post: discussion, polls,
            shared information and activities with other {intent.car.displayName} buyers. It is tied
            to this post only and valid for up to 60 days from successful payment.
          </p>
          <Link href={`/posts/${intent.id}/pay`} className="btn">
            {collective ? 'Join collective' : 'Start collective'}
          </Link>
        </>
      ) : null}
    </div>
  );
}
