import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AdminUserDetailDto } from '@zuund/shared';
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

type Action = 'VERIFY' | 'UNVERIFY' | 'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE';

export function UserDetailPage() {
  const { id = '' } = useParams();
  const [user, setUser] = useState<AdminUserDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);

  const load = useCallback(() => {
    api.admin
      .user(id)
      .then(setUser)
      .catch((e: unknown) =>
        setError(e instanceof ApiRequestError ? e.message : 'Could not load user'),
      );
  }, [id]);
  useEffect(load, [load]);

  function act(action: Action) {
    const danger = action === 'SUSPEND' || action === 'DEACTIVATE';
    setConfirm({
      title: `${humanize(action)} this user?`,
      body: danger ? (
        <p>They will be signed out everywhere and cannot sign in until reactivated.</p>
      ) : undefined,
      confirmLabel: humanize(action),
      danger,
      withNote: true,
      onConfirm: async ({ note }) => {
        setUser(await api.admin.userAction(id, action, note));
      },
    });
  }

  if (error) return <ErrorText error={error} />;
  if (!user) return <p className="muted">Loading…</p>;

  const isAdmin = user.role === 'ADMIN';
  return (
    <>
      <PageHeader title={user.name ?? user.email}>
        {user.verificationStatus === 'VERIFIED' ? (
          <button type="button" className="secondary small" onClick={() => act('UNVERIFY')}>
            Unverify
          </button>
        ) : (
          <button type="button" className="small" onClick={() => act('VERIFY')}>
            Verify
          </button>
        )}
        {user.status === 'ACTIVE' && !isAdmin && (
          <button type="button" className="danger small" onClick={() => act('SUSPEND')}>
            Suspend
          </button>
        )}
        {user.status !== 'ACTIVE' && (
          <button type="button" className="small" onClick={() => act('REACTIVATE')}>
            Reactivate
          </button>
        )}
        {user.status !== 'DEACTIVATED' && !isAdmin && (
          <button type="button" className="danger small" onClick={() => act('DEACTIVATE')}>
            Deactivate
          </button>
        )}
      </PageHeader>

      <dl className="defs">
        <Def label="Email">{user.email}</Def>
        <Def label="Role">
          <Badge value={user.role} />
        </Def>
        <Def label="Status">
          <Badge value={user.status} />
        </Def>
        <Def label="Verification">
          <Badge value={user.verificationStatus} />
          {user.verifiedAt && <span className="muted"> since {fmtDate(user.verifiedAt)}</span>}
        </Def>
        <Def label="City">{user.city?.name ?? '—'}</Def>
        <Def label="About">{user.about ?? '—'}</Def>
        <Def label="Joined">{fmtDate(user.createdAt)}</Def>
        <Def label="Reports against">{user.reportsAgainstCount}</Def>
        <Def label="ID">
          <code>{user.id}</code>
        </Def>
      </dl>

      <Section title={`Buying posts (${user.intents.length})`}>
        <Table
          rows={user.intents}
          rowKey={(i) => i.id}
          empty="No buying posts."
          columns={[
            {
              key: 'car',
              header: 'Car',
              render: (i) => <Link to={`/buying-posts/${i.id}`}>{i.car.displayName}</Link>,
            },
            { key: 'city', header: 'City', render: (i) => i.city.name },
            { key: 'tl', header: 'Timeline', render: (i) => humanize(i.purchaseTimeline) },
            { key: 'lvl', header: 'Intent', render: (i) => <Badge value={i.intentLevel} /> },
            { key: 'st', header: 'Status', render: (i) => <Badge value={i.status} /> },
            { key: 'pass', header: 'Pass', render: (i) => <Badge value={i.pass?.status} /> },
            { key: 'created', header: 'Created', render: (i) => fmtDate(i.createdAt) },
          ]}
        />
      </Section>

      <Section title={`Payments (${user.payments.length})`}>
        <Table
          rows={user.payments}
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
            { key: 'created', header: 'Created', render: (p) => fmtDate(p.createdAt) },
          ]}
        />
      </Section>

      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
