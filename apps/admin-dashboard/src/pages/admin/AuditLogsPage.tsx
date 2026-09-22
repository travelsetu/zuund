import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { AuditLogDto } from '@zuund/shared';
import {
  ErrorText,
  Filters,
  LoadMore,
  PageHeader,
  SearchInput,
  Select,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';

const TARGETS = ['User', 'BuyingIntent', 'Collective', 'Payment', 'Report'].map((v) => ({
  value: v,
  label: v,
}));

export function AuditLogsPage() {
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const key = JSON.stringify({ actorId, action, targetType });
  const fetcher = useCallback(
    (cursor: string | undefined) =>
      api.admin.auditLogs({ actorId, action, targetType, cursor, limit: 50 }),
    [actorId, action, targetType],
  );
  const { items, nextCursor, loading, error, loadMore } = usePaged<AuditLogDto>(fetcher, key);

  return (
    <>
      <PageHeader title="Audit logs" />
      <Filters
        onReset={() => {
          setActorId('');
          setAction('');
          setTargetType('');
        }}
      >
        <SearchInput
          label="Actor ID"
          value={actorId}
          onChange={setActorId}
          placeholder="Admin user id"
        />
        <SearchInput
          label="Action"
          value={action}
          onChange={setAction}
          placeholder="e.g. USER_SUSPEND"
        />
        <Select label="Target type" value={targetType} onChange={setTargetType} options={TARGETS} />
      </Filters>
      <ErrorText error={error} />
      <Table<AuditLogDto>
        rows={items}
        loading={loading}
        rowKey={(a) => a.id}
        columns={[
          { key: 'when', header: 'When', render: (a) => fmtDate(a.createdAt) },
          {
            key: 'actor',
            header: 'Admin',
            render: (a) => <Link to={`/users/${a.actor.id}`}>{a.actor.name ?? a.actor.email}</Link>,
          },
          { key: 'action', header: 'Action', render: (a) => <code>{a.action}</code> },
          {
            key: 'target',
            header: 'Target',
            render: (a) => (
              <>
                {a.targetType} {a.targetId && <TargetLink type={a.targetType} id={a.targetId} />}
              </>
            ),
          },
          {
            key: 'meta',
            header: 'Details',
            render: (a) =>
              a.metadata ? <code className="small-text">{JSON.stringify(a.metadata)}</code> : '—',
          },
          { key: 'ip', header: 'IP', render: (a) => a.ipAddress ?? '—' },
        ]}
      />
      <LoadMore nextCursor={nextCursor} loading={loading} onClick={loadMore} count={items.length} />
    </>
  );
}

function TargetLink({ type, id }: { type: string; id: string }) {
  const path: Record<string, string> = {
    User: '/users',
    BuyingIntent: '/buying-posts',
    Collective: '/collectives',
    Payment: '/payments',
  };
  const base = path[type];
  const short = <code>{id.slice(0, 8)}</code>;
  return base ? <Link to={`${base}/${id}`}>{short}</Link> : short;
}
