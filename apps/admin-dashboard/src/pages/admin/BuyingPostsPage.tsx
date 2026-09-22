import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { AdminIntentDto } from '@zuund/shared';
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
import { fmtDate, humanize } from '@/lib/format';
import { usePaged } from '@/lib/usePaged';
import { CatalogFilters } from './CatalogFilters';

const STATUS = ['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'].map((v) => ({ value: v, label: v }));

export function BuyingPostsPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [carId, setCarId] = useState('');
  const [cityId, setCityId] = useState('');
  const key = JSON.stringify({ q, status, carId, cityId });
  const fetcher = useCallback(
    (cursor: string | undefined) =>
      api.admin.intents({ q, status, carId, cityId, cursor, limit: 25 }),
    [q, status, carId, cityId],
  );
  const { items, nextCursor, loading, error, loadMore } = usePaged<AdminIntentDto>(fetcher, key);

  return (
    <>
      <PageHeader title="Buying posts" />
      <Filters
        onReset={() => {
          setQ('');
          setStatus('');
          setCarId('');
          setCityId('');
        }}
      >
        <SearchInput
          label="Search"
          value={q}
          onChange={setQ}
          placeholder="User email, name or car"
        />
        <Select label="Status" value={status} onChange={setStatus} options={STATUS} />
        <CatalogFilters carId={carId} cityId={cityId} onCar={setCarId} onCity={setCityId} />
      </Filters>
      <ErrorText error={error} />
      <Table<AdminIntentDto>
        rows={items}
        loading={loading}
        rowKey={(i) => i.id}
        columns={[
          {
            key: 'car',
            header: 'Car',
            render: (i) => <Link to={`/buying-posts/${i.id}`}>{i.car.displayName}</Link>,
          },
          { key: 'city', header: 'City', render: (i) => i.city.name },
          {
            key: 'user',
            header: 'User',
            render: (i) => <Link to={`/users/${i.user.id}`}>{i.user.name ?? i.user.email}</Link>,
          },
          { key: 'tl', header: 'Timeline', render: (i) => humanize(i.purchaseTimeline) },
          { key: 'lvl', header: 'Intent', render: (i) => <Badge value={i.intentLevel} /> },
          { key: 'st', header: 'Status', render: (i) => <Badge value={i.status} /> },
          { key: 'pass', header: 'Pass', render: (i) => <Badge value={i.pass?.status} /> },
          { key: 'created', header: 'Created', render: (i) => fmtDate(i.createdAt) },
        ]}
      />
      <LoadMore nextCursor={nextCursor} loading={loading} onClick={loadMore} count={items.length} />
    </>
  );
}
