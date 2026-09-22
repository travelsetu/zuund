import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import type { AdminUserDto } from '@zuund/shared';
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

const STATUS = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].map((v) => ({ value: v, label: v }));
const VERIFICATION = ['VERIFIED', 'UNVERIFIED'].map((v) => ({ value: v, label: v }));
const ROLE = ['USER', 'ADMIN'].map((v) => ({ value: v, label: v }));

export function UsersPage() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [verification, setVerification] = useState('');
  const [role, setRole] = useState('');
  const key = JSON.stringify({ q, status, verification, role });
  const fetcher = useCallback(
    (cursor: string | undefined) =>
      api.admin.users({ q, status, verification, role, cursor, limit: 25 }),
    [q, status, verification, role],
  );
  const { items, nextCursor, loading, error, loadMore } = usePaged<AdminUserDto>(fetcher, key);

  return (
    <>
      <PageHeader title="Users" />
      <Filters
        onReset={() => {
          setQ('');
          setStatus('');
          setVerification('');
          setRole('');
        }}
      >
        <SearchInput label="Search" value={q} onChange={setQ} placeholder="Email or name" />
        <Select label="Status" value={status} onChange={setStatus} options={STATUS} />
        <Select
          label="Verification"
          value={verification}
          onChange={setVerification}
          options={VERIFICATION}
        />
        <Select label="Role" value={role} onChange={setRole} options={ROLE} />
      </Filters>
      <ErrorText error={error} />
      <Table<AdminUserDto>
        rows={items}
        loading={loading}
        rowKey={(u) => u.id}
        columns={[
          {
            key: 'name',
            header: 'User',
            render: (u) => <Link to={`/users/${u.id}`}>{u.name ?? '(no name)'}</Link>,
          },
          { key: 'email', header: 'Email', render: (u) => u.email },
          { key: 'city', header: 'City', render: (u) => u.city?.name ?? '—' },
          { key: 'role', header: 'Role', render: (u) => <Badge value={u.role} /> },
          { key: 'status', header: 'Status', render: (u) => <Badge value={u.status} /> },
          {
            key: 'ver',
            header: 'Verification',
            render: (u) => <Badge value={u.verificationStatus} />,
          },
          { key: 'posts', header: 'Active posts', render: (u) => u.activeIntentCount },
          { key: 'passes', header: 'Active passes', render: (u) => u.activePassCount },
          { key: 'created', header: 'Joined', render: (u) => fmtDate(u.createdAt) },
        ]}
      />
      <LoadMore nextCursor={nextCursor} loading={loading} onClick={loadMore} count={items.length} />
    </>
  );
}
