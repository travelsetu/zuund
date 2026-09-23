import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AdminCollectiveDto, AdminCollectiveMemberDto } from '@zuund/shared';
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
import { fmtDate, humanize } from '@/lib/format';

type Detail = AdminCollectiveDto & { members: AdminCollectiveMemberDto[] };
type Action = 'CLOSE' | 'ARCHIVE' | 'REOPEN';

export function CollectiveDetailPage() {
  const { id = '' } = useParams();
  const [c, setC] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);

  const load = useCallback(() => {
    api.admin
      .collective(id)
      .then(setC)
      .catch((e: unknown) =>
        setError(e instanceof ApiRequestError ? e.message : 'Could not load collective'),
      );
  }, [id]);
  useEffect(load, [load]);

  function act(action: Action) {
    setConfirm({
      title: `${humanize(action)} this collective?`,
      body:
        action !== 'REOPEN' ? (
          <p>
            Members keep their history; paid access to discussion, polls and files stops while it is
            not active.
          </p>
        ) : undefined,
      confirmLabel: humanize(action),
      danger: action !== 'REOPEN',
      withNote: true,
      onConfirm: async ({ note }) => setC(await api.admin.collectiveAction(id, action, note)),
    });
  }

  if (error) return <ErrorText error={error} />;
  if (!c) return <p className="muted">Loading…</p>;

  return (
    <>
      <PageHeader title={c.name}>
        {c.status === 'ACTIVE' && (
          <button type="button" className="danger small" onClick={() => act('CLOSE')}>
            Close
          </button>
        )}
        {c.status !== 'ARCHIVED' && (
          <button type="button" className="secondary small" onClick={() => act('ARCHIVE')}>
            Archive
          </button>
        )}
        {c.status !== 'ACTIVE' && (
          <button type="button" className="small" onClick={() => act('REOPEN')}>
            Reopen
          </button>
        )}
      </PageHeader>

      <dl className="defs">
        <Def label="Car">{c.car.displayName}</Def>
        <Def label="City">{c.city.name}</Def>
        <Def label="Creator">
          <Link to={`/users/${c.creator.id}`}>{c.creator.name ?? c.creator.email}</Link>
        </Def>
        <Def label="Status">
          <Badge value={c.status} />
        </Def>
        <Def label="Active members">{c.activeMemberCount}</Def>
        <Def label="Pending payment">{c.pendingMemberCount}</Def>
        <Def label="Created">{fmtDate(c.createdAt)}</Def>
        <Def label="Closed">{fmtDate(c.closedAt)}</Def>
        <Def label="ID">
          <code>{c.id}</code>
        </Def>
      </dl>

      <Section title={`Members (${c.members.length})`}>
        <Table<AdminCollectiveMemberDto>
          rows={c.members}
          rowKey={(m) => m.membershipId}
          empty="No members yet."
          columns={[
            {
              key: 'user',
              header: 'Member',
              render: (m) => <Link to={`/users/${m.user.id}`}>{m.user.name ?? m.user.email}</Link>,
            },
            { key: 'email', header: 'Email', render: (m) => m.user.email ?? '—' },
            { key: 'st', header: 'Membership', render: (m) => <Badge value={m.status} /> },
            { key: 'lvl', header: 'Intent', render: (m) => <Badge value={m.intentLevel} /> },
            { key: 'tl', header: 'Timeline', render: (m) => humanize(m.purchaseTimeline) },
            {
              key: 'post',
              header: 'Post',
              render: (m) => (
                <Link to={`/buying-posts/${m.buyingIntentId}`}>
                  <code>{m.buyingIntentId.slice(0, 8)}</code>
                </Link>
              ),
            },
            { key: 'joined', header: 'Joined', render: (m) => fmtDate(m.joinedAt) },
            { key: 'left', header: 'Left', render: (m) => fmtDate(m.leftAt) },
          ]}
        />
      </Section>

      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
