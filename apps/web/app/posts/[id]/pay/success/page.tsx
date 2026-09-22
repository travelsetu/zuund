'use client';

import type { BuyingIntentDto, PaymentDto } from '@zuund/shared';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { formatDate, rupees } from '@/lib/format';
import { clearIdempotencyKey } from '@/lib/payments';

const POLL_MS = 3000;
const POLL_FOR_MS = 60_000;

/**
 * Spec §71: shown only once the server says SUCCESS. If the popup was closed
 * before the callback, the webhook may still land, so a PENDING payment is
 * polled for up to a minute before giving up.
 */
function SuccessScreen({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const paymentId = params.get('paymentId');
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [intent, setIntent] = useState<BuyingIntentDto | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentId) {
      router.replace(`/posts/${id}/pay/failed`);
      return;
    }
    let cancelled = false;
    const started = Date.now();
    const check = async () => {
      try {
        const p = await api.payments.get(paymentId);
        if (cancelled) return;
        if (p.status === 'SUCCESS') {
          clearIdempotencyKey(id);
          setPayment(p);
          setIntent(await api.intents.get(id));
        } else if (p.status === 'PENDING' || p.status === 'INITIATED') {
          if (Date.now() - started < POLL_FOR_MS) setTimeout(check, POLL_MS);
          else router.replace(`/posts/${id}/pay/failed?paymentId=${paymentId}`);
        } else router.replace(`/posts/${id}/pay/failed?paymentId=${paymentId}`);
      } catch (e) {
        if (!cancelled) setErr(errorMessage(e));
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [id, paymentId, router]);

  if (err) return <p className="error">{err}</p>;
  if (!payment || !intent) {
    return (
      <div className="narrow card pad-lg center-text" style={{ margin: '24px auto' }}>
        <h1>Confirming your payment…</h1>
        <p className="muted">
          Waiting for the payment provider to confirm. This usually takes a few seconds.
        </p>
      </div>
    );
  }
  const collectiveId = intent.membership?.collectiveId;
  return (
    <div className="narrow card pad-lg stack" style={{ margin: '24px auto' }}>
      <h1 className="success">Payment Successful</h1>
      <div className="stat">
        <span className="num">{rupees(payment.amount)}</span>
        <span className="muted">
          {intent.car.displayName} · {intent.city.name}
        </span>
      </div>
      <p>
        Buying Pass: <strong>{intent.pass?.status ?? 'ACTIVE'}</strong>
        <br />
        Valid until: <strong>{formatDate(intent.pass?.expiresAt)}</strong>
      </p>
      {collectiveId ? (
        <Link
          href={`/collectives/${collectiveId}`}
          className="btn block"
          style={{ justifyContent: 'center' }}
        >
          GO TO COLLECTIVE
        </Link>
      ) : (
        <Link href={`/posts/${id}`} className="btn block" style={{ justifyContent: 'center' }}>
          Back to post
        </Link>
      )}
    </div>
  );
}

export default function PaySuccessPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <Suspense>
        <SuccessScreen id={id} />
      </Suspense>
    </RequireAuth>
  );
}
