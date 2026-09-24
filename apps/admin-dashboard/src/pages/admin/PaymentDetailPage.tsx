import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AdminPaymentDto } from '@zuund/shared';
import {
  Badge,
  ConfirmDialog,
  Def,
  ErrorText,
  PageHeader,
  type ConfirmSpec,
} from '@/components/ui';
import { api, ApiRequestError } from '@/lib/api';
import { fmtDate, fmtPaise } from '@/lib/format';

export function PaymentDetailPage() {
  const { id = '' } = useParams();
  const [p, setP] = useState<AdminPaymentDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);

  const load = useCallback(() => {
    api.admin
      .payment(id)
      .then(setP)
      .catch((e: unknown) =>
        setError(e instanceof ApiRequestError ? e.message : 'Could not load payment'),
      );
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorText error={error} />;
  if (!p) return <p className="muted">Loading…</p>;

  return (
    <>
      <PageHeader title={`Payment ${p.id.slice(0, 8)}`}>
        {p.status === 'SUCCESS' && (
          <button
            type="button"
            className="danger small"
            onClick={() =>
              setConfirm({
                title: 'Refund this payment?',
                body: (
                  <p>
                    The Elite Pass and any collective membership tied to it will be marked refunded.
                    This cannot be undone here.
                  </p>
                ),
                confirmLabel: 'Refund',
                danger: true,
                withNote: true,
                withAmount: { max: p.amount },
                onConfirm: async ({ note, amountPaise }) =>
                  setP(await api.admin.refund(id, amountPaise, note)),
              })
            }
          >
            Refund
          </button>
        )}
      </PageHeader>

      <dl className="defs">
        <Def label="Status">
          <Badge value={p.status} />
        </Def>
        <Def label="Amount">
          {fmtPaise(p.amount)} {p.currency}
        </Def>
        <Def label="User">
          <Link to={`/users/${p.user.id}`}>{p.user.name ?? p.user.email}</Link>{' '}
          <span className="muted">{p.user.email}</span>
        </Def>
        <Def label="Buying post">
          <Link to={`/buying-posts/${p.buyingIntentId}`}>
            {p.car.displayName} · {p.city.name}
          </Link>
        </Def>
        <Def label="Buying pass">{p.buyingPassId ? <code>{p.buyingPassId}</code> : '—'}</Def>
        <Def label="Provider">{p.provider}</Def>
        <Def label="Provider order">
          <code>{p.providerOrderId ?? '—'}</code>
        </Def>
        <Def label="Provider payment">
          <code>{p.providerPaymentId ?? '—'}</code>
        </Def>
        <Def label="Idempotency key">
          <code>{p.idempotencyKey}</code>
        </Def>
        <Def label="Failure reason">{p.failureReason ?? '—'}</Def>
        <Def label="Refunded">
          {p.refundedAmount !== null ? fmtPaise(p.refundedAmount) : '—'}
          {p.providerRefundId && (
            <span className="muted">
              {' '}
              · <code>{p.providerRefundId}</code>
            </span>
          )}
        </Def>
        <Def label="Created">{fmtDate(p.createdAt)}</Def>
        <Def label="Updated">{fmtDate(p.updatedAt)}</Def>
        <Def label="ID">
          <code>{p.id}</code>
        </Def>
      </dl>

      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
