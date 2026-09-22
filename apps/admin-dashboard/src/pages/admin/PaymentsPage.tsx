import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { AdminPaymentDto } from '@zuund/shared';
import {
  Badge,
  ErrorText,
  Filters,
  LoadMore,
  PageHeader,
  SearchInput,
  Select,
  Table,
} from '@/components/ui';
import { api } from '@/lib/api';
import { fmtDate, fmtPaise } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';

const STATUS = ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'].map((v) => ({
  value: v,
  label: v,
}));

export function PaymentsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const key = JSON.stringify({ q, status });
  const fetcher = useCallback(
    (cursor: string | undefined) => api.admin.payments({ q, status, cursor, limit: 25 }),
    [q, status],
  );
  const { items, nextCursor, loading, error, loadMore } = usePaged<AdminPaymentDto>(fetcher, key);

  return (
    <>
      <PageHeader title="Payments">
        <button type="button" className="secondary small" onClick={() => setStatus('FAILED')}>
          Show failed
        </button>
      </PageHeader>
      <Filters
        onReset={() => {
          setQ('');
          setStatus('');
        }}
      >
        <SearchInput
          label="Search"
          value={q}
          onChange={setQ}
          placeholder="Order id, payment id or user email"
        />
        <Select label="Status" value={status} onChange={setStatus} options={STATUS} />
      </Filters>
      <ErrorText error={error} />
      <Table<AdminPaymentDto>
        rows={items}
        loading={loading}
        rowKey={(p) => p.id}
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
          {
            key: 'user',
            header: 'User',
            render: (p) => <Link to={`/users/${p.user.id}`}>{p.user.name ?? p.user.email}</Link>,
          },
          {
            key: 'post',
            header: 'Post',
            render: (p) => (
              <Link to={`/buying-posts/${p.buyingIntentId}`}>
                {p.car.displayName} · {p.city.name}
              </Link>
            ),
          },
          { key: 'amt', header: 'Amount', render: (p) => fmtPaise(p.amount) },
          { key: 'st', header: 'Status', render: (p) => <Badge value={p.status} /> },
          { key: 'prov', header: 'Provider', render: (p) => p.provider },
          { key: 'oid', header: 'Order', render: (p) => <code>{p.providerOrderId ?? '—'}</code> },
          { key: 'created', header: 'Created', render: (p) => fmtDate(p.createdAt) },
        ]}
      />
      <LoadMore nextCursor={nextCursor} loading={loading} onClick={loadMore} count={items.length} />
    </>
  );
}
