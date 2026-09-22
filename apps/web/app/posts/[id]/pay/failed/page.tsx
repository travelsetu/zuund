'use client';

import type { BuyingIntentDto, PaymentDto } from '@zuund/shared';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';

/** Spec §72. Retry goes back to /pay; the idempotency key is kept, so no second payment is created. */
function FailedScreen({ id }: { id: string }) {
  const params = useSearchParams();
  const paymentId = params.get('paymentId');
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [intent, setIntent] = useState<BuyingIntentDto | null>(null);

  useEffect(() => {
    api.intents
      .get(id)
      .then(setIntent)
      .catch(() => {});
    if (paymentId)
      api.payments
        .get(paymentId)
        .then(setPayment)
        .catch(() => {});
  }, [id, paymentId]);

  const pass = intent?.pass;
  return (
    <div className="narrow card pad-lg stack" style={{ margin: '24px auto' }}>
      <h1 className="error">Payment unsuccessful.</h1>
      <p className="muted">
        Nothing has been activated. If money left your account, it will be reversed by the payment
        provider.
      </p>
      {payment && (
        <p className="small">
          Payment status: <strong>{payment.status.toLowerCase()}</strong>
          {payment.providerOrderId ? ` · ref ${payment.providerOrderId}` : ''}
        </p>
      )}
      {intent && (
        <p className="small">
          Buying Pass for {intent.car.displayName} · {intent.city.name}:{' '}
          <strong>{pass ? pass.status : 'none'}</strong>
          {pass?.expiresAt
            ? ` · ${pass.status === 'ACTIVE' ? 'expires' : 'expiry'} ${formatDate(pass.expiresAt)}`
            : ''}
        </p>
      )}
      <div className="row">
        <Link href={`/posts/${id}/pay`} className="btn">
          Retry
        </Link>
        <Link href={`/posts/${id}`} className="btn secondary">
          Back to post
        </Link>
      </div>
    </div>
  );
}

export default function PayFailedPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <Suspense>
        <FailedScreen id={id} />
      </Suspense>
    </RequireAuth>
  );
}
