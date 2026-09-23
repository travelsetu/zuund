import type { CollectiveMemberDto, IntentLevel } from '@zuund/shared';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { BuyerRow } from '@/components/BuyerRow';
import { ConnectButton, type ConnectionRef } from '@/components/ConnectButton';
import { Button, Chip, ChipRow, Empty, Header, Loading, Screen, SearchBox } from '@/components/ui';
import { api } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useFocusData } from '@/lib/useAsync';
import { type } from '@/theme';

type Filter = 'ALL' | IntentLevel;

/** Mockup 9 — members with search and intent filters, each with Connect. */
export default function Members() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const { data, setData, error, refresh, refreshing } = useFocusData(
    () => api.collectives.members(id),
    [id],
  );
  const setConnection = (userId: string, c: ConnectionRef | null) =>
    data &&
    setData({
      ...data,
      items: data.items.map((m) => (m.user.id === userId ? { ...m, connection: c } : m)),
    });

  const [more, setMore] = useState(false);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (m: CollectiveMemberDto) =>
        (filter === 'ALL' || m.intentLevel === filter) &&
        (!t || (m.user.name ?? '').toLowerCase().includes(t)),
    );
  }, [data, q, filter]);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header
        title={data ? `Members (${data.items.length}${data.nextCursor ? '+' : ''})` : 'Members'}
      />
      <SearchBox value={q} onChangeText={setQ} placeholder="Search members…" />
      <ChipRow>
        {(['ALL', 'READY', 'COMMITTED', 'INTERESTED'] as const).map((f) => (
          <Chip
            key={f}
            label={f === 'ALL' ? 'All' : f[0] + f.slice(1).toLowerCase()}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ChipRow>
      {!data ? (
        error ? (
          <Text style={type.small}>{error}</Text>
        ) : (
          <Loading />
        )
      ) : shown.length === 0 ? (
        <Empty icon="people-outline" title="No members match" />
      ) : (
        <View>
          {shown.map((m) => (
            <BuyerRow
              key={m.membershipId}
              user={m.user}
              purchaseTimeline={m.purchaseTimeline}
              intentLevel={m.intentLevel}
              action={
                m.user.id === me.id ? (
                  <Text style={type.small}>You</Text>
                ) : (
                  <ConnectButton
                    userId={m.user.id}
                    meId={me.id}
                    connection={m.connection}
                    onChange={(c) => setConnection(m.user.id, c)}
                  />
                )
              }
            />
          ))}
        </View>
      )}
      {data?.nextCursor ? (
        <Button
          variant="outline"
          title="Load more"
          loading={more}
          onPress={async () => {
            setMore(true);
            const next = await api.collectives.members(id, data.nextCursor!).catch(() => null);
            if (next)
              setData({ items: [...data.items, ...next.items], nextCursor: next.nextCursor });
            setMore(false);
          }}
        />
      ) : null}
    </Screen>
  );
}
