import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AdminIntentDetailDto } from '@zuund/shared';
import {
  Badge,
  ConfirmDialog,
  Def,
  ErrorText,
  PageHeader,
  Section,
  Table,
  type ConfirmSpec,
} from '@/components/ui';
import { api, ApiRequestError } from '@/lib/api';
import { fmtDate, fmtPaise, humanize } from '@/lib/format';

export function BuyingPostDetailPage() {
  const { id = '' } = useParams();
  const [intent, setIntent] = useState<AdminIntentDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);

  const load = useCallback(() => {
    api.admin
      .intent(id)
      .then(setIntent)
      .catch((e: unknown) =>
        setError(e instanceof ApiRequestError ? e.message : 'Could not load buying post'),
      );
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorText error={error} />;
  if (!intent) return <p className="muted">Loading…</p>;

  const closable = intent.status === 'ACTIVE' || intent.status === 'PAUSED';
  return (
    <>
      <PageHeader title={`${intent.car.displayName} · ${intent.city.name}`}>
        {closable && (
          <button
            type="button"
            className="danger small"
            onClick={() =>
              setConfirm({
                title: 'Close this buying post?',
                body: <p>Closing is final. The user can create a new post later.</p>,
                confirmLabel: 'Close post',
                danger: true,
                withNote: true,
                onConfirm: async ({ note }) => setIntent(await api.admin.closeIntent(id, note)),
              })
            }
          >
            Close post
          </button>
        )}
      </PageHeader>

      <dl className="defs">
        <Def label="User">
          <Link to={`/users/${intent.user.id}`}>{intent.user.name ?? intent.user.email}</Link>{' '}
          <span className="muted">{intent.user.email}</span>
        </Def>
        <Def label="Status">
          <Badge value={intent.status} />
        </Def>
        <Def label="Intent level">
          <Badge value={intent.intentLevel} />
        </Def>
        <Def label="Buying timeline">{humanize(intent.purchaseTimeline)}</Def>
        <Def label="Created">{fmtDate(intent.createdAt)}</Def>
        <Def label="Paused">{fmtDate(intent.pausedAt)}</Def>
        <Def label="Closed">{fmtDate(intent.closedAt)}</Def>
        <Def label="Membership">
          {intent.membership ? (
            <>
              <Badge value={intent.membership.status} /> in{' '}
              <Link to={`/collectives/${intent.membership.collectiveId}`}>collective</Link>
            </>
          ) : (
            '—'
          )}
        </Def>
        <Def label="ID">
          <code>{intent.id}</code>
        </Def>
      </dl>

      <Section title="Intent history">
        <Table
          rows={intent.history}
          rowKey={(h) => h.id}
          empty="No changes."
          columns={[
            { key: 'when', header: 'When', render: (h) => fmtDate(h.changedAt) },
            { key: 'from', header: 'From', render: (h) => <Badge value={h.previousLevel} /> },
            { key: 'to', header: 'To', render: (h) => <Badge value={h.newLevel} /> },
            {
              key: 'by',
              header: 'Changed by',
              render: (h) => <code>{h.changedById.slice(0, 8)}</code>,
            },
          ]}
        />
      </Section>

      <Section title="Buying passes">
        <Table
          rows={intent.passes}
          rowKey={(p) => p.id}
          empty="No pass."
          columns={[
            { key: 'st', header: 'Status', render: (p) => <Badge value={p.status} /> },
            { key: 'amt', header: 'Amount', render: (p) => fmtPaise(p.amount) },
            { key: 'act', header: 'Activated', render: (p) => fmtDate(p.activatedAt) },
            { key: 'exp', header: 'Expires', render: (p) => fmtDate(p.expiresAt) },
            { key: 'created', header: 'Created', render: (p) => fmtDate(p.createdAt) },
          ]}
        />
      </Section>

      <Section title="Payments">
        <Table
          rows={intent.payments}
          rowKey={(p) => p.id}
          empty="No payments."
          columns={[
            {
              key: 'id',
              header: 'Payment',
              render: (p) => (
                <Link to={`/payments/${p.id}`}>
                  <code>{p.id.slice(0, 8)}</code>
                </Link>
              ),
            },
            { key: 'amt', header: 'Amount', render: (p) => fmtPaise(p.amount) },
            { key: 'st', header: 'Status', render: (p) => <Badge value={p.status} /> },
            { key: 'prov', header: 'Provider', render: (p) => p.provider },
            { key: 'oid', header: 'Order', render: (p) => p.providerOrderId ?? '—' },
            { key: 'created', header: 'Created', render: (p) => fmtDate(p.createdAt) },
          ]}
        />
      </Section>

      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
