import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { AdminCollectiveDto } from '@zuund/shared';
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
import { fmtDate } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';
import { CatalogFilters } from './CatalogFilters';

const STATUS = ['ACTIVE', 'CLOSED', 'ARCHIVED'].map((v) => ({ value: v, label: v }));

export function CollectivesPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [carId, setCarId] = useState('');
  const [cityId, setCityId] = useState('');
  const key = JSON.stringify({ q, status, carId, cityId });
  const fetcher = useCallback(
    (cursor: string | undefined) =>
      api.admin.collectives({ q, status, carId, cityId, cursor, limit: 25 }),
    [q, status, carId, cityId],
  );
  const { items, nextCursor, loading, error, loadMore } = usePaged<AdminCollectiveDto>(
    fetcher,
    key,
  );

  return (
    <>
      <PageHeader title="Collectives" />
      <Filters
        onReset={() => {
          setQ('');
          setStatus('');
          setCarId('');
          setCityId('');
        }}
      >
        <SearchInput label="Search" value={q} onChange={setQ} placeholder="Collective name" />
        <Select label="Status" value={status} onChange={setStatus} options={STATUS} />
        <CatalogFilters carId={carId} cityId={cityId} onCar={setCarId} onCity={setCityId} />
      </Filters>
      <ErrorText error={error} />
      <Table<AdminCollectiveDto>
        rows={items}
        loading={loading}
        rowKey={(c) => c.id}
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (c) => <Link to={`/collectives/${c.id}`}>{c.name}</Link>,
          },
          { key: 'car', header: 'Car', render: (c) => c.car.displayName },
          { key: 'city', header: 'City', render: (c) => c.city.name },
          {
            key: 'creator',
            header: 'Creator',
            render: (c) => (
              <Link to={`/users/${c.creator.id}`}>{c.creator.name ?? c.creator.email}</Link>
            ),
          },
          { key: 'st', header: 'Status', render: (c) => <Badge value={c.status} /> },
          { key: 'active', header: 'Active members', render: (c) => c.activeMemberCount },
          { key: 'pending', header: 'Pending payment', render: (c) => c.pendingMemberCount },
          { key: 'created', header: 'Created', render: (c) => fmtDate(c.createdAt) },
        ]}
      />
      <LoadMore nextCursor={nextCursor} loading={loading} onClick={loadMore} count={items.length} />
    </>
  );
}
