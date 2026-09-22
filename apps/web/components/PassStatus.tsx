'use client';

import type { BuyingIntentDto } from '@zuund/shared';
import Link from 'next/link';
import { formatDate } from '@/lib/format';

/**
 * The pass as the server reports it. Dates are displayed, never computed
 * here, and an expired pass is never renewed: the only way on is a new post.
 */
export function PassStatus({ intent }: { intent: BuyingIntentDto }) {
  const pass = intent.pass;
  if (!pass) return null;
  if (pass.status === 'ACTIVE') {
    return (
      <div className="notice">
        <strong>Buying Pass ACTIVE</strong> · Expires {formatDate(pass.expiresAt)}
      </div>
    );
  }
  if (pass.status === 'EXPIRED') {
    return (
      <div className="notice warn stack" style={{ gap: 8 }}>
        <div>
          <strong>Buying Pass EXPIRED</strong> · Expired {formatDate(pass.expiresAt)}
        </div>
        <div className="small">
          Paid access for this buying post has ended. Still buying? Start a new post; a new Buying
          Pass can be bought for it.
        </div>
        <div>
          <Link
            href={`/posts/new?carId=${intent.car.id}&carName=${encodeURIComponent(intent.car.displayName)}&cityId=${intent.city.id}`}
            className="btn sm"
          >
            Create New Buying Post
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="small muted">
      Buying Pass: {pass.status.toLowerCase()}
      {pass.activatedAt ? ` · activated ${formatDate(pass.activatedAt)}` : ''}
    </div>
  );
}
