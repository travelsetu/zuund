import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { AdminReportDto } from '@zuund/shared';
import {
  Badge,
  ConfirmDialog,
  ErrorText,
  Filters,
  LoadMore,
  PageHeader,
  Select,
  Table,
  type ConfirmSpec,
} from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, humanize } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';

const STATUS = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].map((v) => ({
  value: v,
  label: v,
}));
const TARGETS = ['USER', 'MESSAGE', 'SHARED_FILE', 'POLL', 'COLLECTIVE'].map((v) => ({
  value: v,
  label: humanize(v),
}));
type Action = 'REVIEW' | 'RESOLVE' | 'DISMISS';

export function ReportsPage() {
  const [status, setStatus] = useState('OPEN');
  const [targetType, setTargetType] = useState('');
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null);
  const key = JSON.stringify({ status, targetType });
  const fetcher = useCallback(
    (cursor: string | undefined) => api.admin.reports({ status, targetType, cursor, limit: 25 }),
    [status, targetType],
  );
  const { items, nextCursor, loading, error, loadMore, reload } = usePaged<AdminReportDto>(
    fetcher,
    key,
  );

  function act(r: AdminReportDto, action: Action) {
    setConfirm({
      title: `${humanize(action)} report?`,
      body: (
        <p>
          <strong>{r.reason}</strong>
          {r.details && (
            <>
              <br />
              {r.details}
            </>
          )}
        </p>
      ),
      confirmLabel: humanize(action),
      withNote: action !== 'REVIEW',
      onConfirm: async ({ note }) => {
        await api.admin.reportAction(r.id, action, note);
        await reload();
      },
    });
  }

  return (
    <>
      <PageHeader title="Reports" />
      <Filters
        onReset={() => {
          setStatus('');
          setTargetType('');
        }}
      >
        <Select label="Status" value={status} onChange={setStatus} options={STATUS} />
        <Select label="Target" value={targetType} onChange={setTargetType} options={TARGETS} />
      </Filters>
      <ErrorText error={error} />
      <Table<AdminReportDto>
        rows={items}
        loading={loading}
        rowKey={(r) => r.id}
        columns={[
          { key: 'when', header: 'Filed', render: (r) => fmtDate(r.createdAt) },
          { key: 'st', header: 'Status', render: (r) => <Badge value={r.status} /> },
          {
            key: 'target',
            header: 'Target',
            render: (r) => (
              <>
                <span className="chip">{humanize(r.targetType)}</span>{' '}
                {r.targetPreview ? (
                  <span className="muted">“{r.targetPreview}”</span>
                ) : (
                  <code>{r.targetId.slice(0, 8)}</code>
                )}
              </>
            ),
          },
          {
            key: 'reason',
            header: 'Reason',
            render: (r) => (
              <>
                <strong>{r.reason}</strong>
                {r.details && <div className="muted small-text">{r.details}</div>}
              </>
            ),
          },
          {
            key: 'reporter',
            header: 'Reporter',
            render: (r) => (
              <Link to={`/users/${r.reporter.id}`}>{r.reporter.name ?? r.reporter.email}</Link>
            ),
          },
          {
            key: 'reported',
            header: 'Reported user',
            render: (r) =>
              r.reportedUser ? (
                <Link to={`/users/${r.reportedUser.id}`}>
                  {r.reportedUser.name ?? r.reportedUser.email}
                </Link>
              ) : (
                '—'
              ),
          },
          {
            key: 'res',
            header: 'Resolution',
            render: (r) =>
              r.resolvedAt ? (
                <span className="muted small-text">
                  {fmtDate(r.resolvedAt)}
                  {r.resolutionNote && <> · {r.resolutionNote}</>}
                </span>
              ) : (
                '—'
              ),
          },
          {
            key: 'actions',
            header: '',
            render: (r) =>
              r.status === 'OPEN' || r.status === 'UNDER_REVIEW' ? (
                <div className="row-actions">
                  {r.status === 'OPEN' && (
                    <button
                      type="button"
                      className="secondary small"
                      onClick={() => act(r, 'REVIEW')}
                    >
                      Review
                    </button>
                  )}
                  <button type="button" className="small" onClick={() => act(r, 'RESOLVE')}>
                    Resolve
                  </button>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => act(r, 'DISMISS')}
                  >
                    Dismiss
                  </button>
                </div>
              ) : null,
          },
        ]}
      />
      <LoadMore nextCursor={nextCursor} loading={loading} onClick={loadMore} count={items.length} />
      <ConfirmDialog spec={confirm} onClose={() => setConfirm(null)} />
    </>
  );
}
