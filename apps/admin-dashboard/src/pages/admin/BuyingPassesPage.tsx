import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { AdminPassDto } from '@zuund/shared';
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

const STATUS = ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'REFUNDED'].map((v) => ({
  value: v,
  label: v,
}));

export function BuyingPassesPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const key = JSON.stringify({ q, status });
  const fetcher = useCallback(
    (cursor: string | undefined) => api.admin.passes({ q, status, cursor, limit: 25 }),
    [q, status],
  );
  const { items, nextCursor, loading, error, loadMore } = usePaged<AdminPassDto>(fetcher, key);

  return (
    <>
      <PageHeader title="Buying passes" />
      <Filters
        onReset={() => {
          setQ('');
          setStatus('');
        }}
      >
        <SearchInput label="Search" value={q} onChange={setQ} placeholder="User email" />
        <Select label="Status" value={status} onChange={setStatus} options={STATUS} />
      </Filters>
      <ErrorText error={error} />
      <Table<AdminPassDto>
        rows={items}
        loading={loading}
        rowKey={(p) => p.id}
        columns={[
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
          { key: 'st', header: 'Status', render: (p) => <Badge value={p.status} /> },
          { key: 'amt', header: 'Amount', render: (p) => fmtPaise(p.amount) },
          { key: 'act', header: 'Activated', render: (p) => fmtDate(p.activatedAt) },
          { key: 'exp', header: 'Expires', render: (p) => fmtDate(p.expiresAt) },
          {
            key: 'pay',
            header: 'Payment',
            render: (p) =>
              p.paymentId ? (
                <Link to={`/payments/${p.paymentId}`}>
                  <code>{p.paymentId.slice(0, 8)}</code>
                </Link>
              ) : (
                '—'
              ),
          },
          { key: 'created', header: 'Created', render: (p) => fmtDate(p.createdAt) },
        ]}
      />
      <LoadMore nextCursor={nextCursor} loading={loading} onClick={loadMore} count={items.length} />
    </>
  );
}
