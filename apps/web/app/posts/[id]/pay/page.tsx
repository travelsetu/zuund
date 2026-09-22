'use client';

import type { BuyingIntentDto, PaymentCheckoutDto } from '@zuund/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiRequestError, errorMessage } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';
import { rupees } from '@/lib/format';
import {
  clearIdempotencyKey,
  idempotencyKeyFor,
  payWithMock,
  payWithRazorpay,
} from '@/lib/payments';

/** Spec §70: the pay screen. Amount comes from the API's payment record, never a constant. */
function PayScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [intent, setIntent] = useState<BuyingIntentDto | null>(null);
  const [checkout, setCheckout] = useState<PaymentCheckoutDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.intents
      .get(id)
      .then((i) => {
        setIntent(i);
        if (i.pass?.status === 'ACTIVE' && i.membership?.collectiveId)
          router.replace(`/collectives/${i.membership.collectiveId}`);
      })
      .catch((e) => setErr(errorMessage(e)));
  }, [id, router]);

  /** Makes sure this post is in the right collective, then opens (or reuses) the payment. */
  async function preparePayment(): Promise<PaymentCheckoutDto> {
    const i = intent!;
    let collectiveId = i.membership?.collectiveId;
    if (!collectiveId) {
      const page = await api.collectives.list({ carId: i.car.id, cityId: i.city.id });
      const existing = page.items[0];
      const col = existing
        ? await api.collectives.join(existing.id, i.id)
        : await api.collectives.create(i.id);
      collectiveId = col.id;
    }
    const c = await api.payments.create({
      buyingIntentId: i.id,
      collectiveId,
      idempotencyKey: idempotencyKeyFor(i.id),
    });
    setCheckout(c);
    return c;
  }

  async function pay() {
    if (!intent) return;
    setBusy(true);
    setErr(null);
    try {
      const c = checkout ?? (await preparePayment());
      if (c.provider === 'razorpay') {
        const result = await payWithRazorpay(c, user?.name ?? null, user?.email ?? '');
        if (!result) {
          setBusy(false);
          return; // closed the window; nothing charged
        }
        if (result.status === 'SUCCESS') {
          clearIdempotencyKey(intent.id);
          router.push(`/posts/${intent.id}/pay/success?paymentId=${result.id}`);
        } else router.push(`/posts/${intent.id}/pay/failed?paymentId=${result.id}`);
      } else {
        setBusy(false); // mock: show the simulate button
      }
    } catch (e) {
      if (
        e instanceof ApiRequestError &&
        (e.code === 'PASS_ALREADY_ACTIVE' || e.code === 'PAYMENT_ALREADY_SUCCEEDED')
      ) {
        const i = await api.intents.get(intent.id).catch(() => null);
        if (i?.membership?.collectiveId)
          return router.replace(`/collectives/${i.membership.collectiveId}`);
      }
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  async function simulate() {
    if (!checkout || !intent) return;
    setBusy(true);
    try {
      const result = await payWithMock(checkout);
      if (result.status === 'SUCCESS') {
        clearIdempotencyKey(intent.id);
        router.push(`/posts/${intent.id}/pay/success?paymentId=${result.id}`);
      } else router.push(`/posts/${intent.id}/pay/failed?paymentId=${result.id}`);
    } catch (e) {
      setErr(errorMessage(e));
      router.push(`/posts/${intent.id}/pay/failed?paymentId=${checkout.payment.id}`);
    }
  }

  if (!intent) return err ? <p className="error">{err}</p> : <p className="muted">Loading…</p>;
  const amount = checkout?.payment.amount;

  return (
    <div className="narrow stack" style={{ margin: '0 auto' }}>
      <Link href={`/posts/${id}`} className="small">
        ← Back to post
      </Link>
      <div className="card pad-lg stack">
        <p className="muted small" style={{ margin: 0 }}>
          For: {intent.car.displayName} — {intent.city.name}
        </p>
        <h1 style={{ margin: 0 }}>Buying Pass</h1>
        <div className="stat">
          <span className="num">{amount !== undefined ? rupees(amount) : '₹500'}</span>
          <span className="muted">Validity: up to 60 days from payment</span>
        </div>
        <p>
          Your Buying Pass is valid for up to 60 days from successful payment for this Buying Post.
        </p>
        <p className="small muted">
          It unlocks the collective for this post only: discussion, polls, shared information and
          activities with other {intent.car.displayName} buyers in {intent.city.name}. Another
          buying post needs its own pass.
        </p>
        {err && <p className="error">{err}</p>}
        {checkout?.provider === 'mock' ? (
          <div className="notice warn stack" style={{ gap: 8 }}>
            <span>
              Mock payment provider is active (development). Simulate the provider callback:
            </span>
            <div>
              <button type="button" onClick={simulate} disabled={busy}>
                Simulate payment (dev only)
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="block" onClick={pay} disabled={busy}>
            {busy ? 'Opening payment…' : `PAY ${amount !== undefined ? rupees(amount) : '₹500'}`}
          </button>
        )}
        <p className="small muted center-text">
          Payment is confirmed by our server with the payment provider before access is granted.
        </p>
      </div>
    </div>
  );
}

export default function PayPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <PayScreen id={id} />
    </RequireAuth>
  );
}
