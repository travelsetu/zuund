import {
  BUYER_FILTERS,
  type BuyerDiscoveryDto,
  type BuyerDto,
  type BuyerFilter,
} from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BuyerRow } from '@/components/BuyerRow';
import { ConnectButton } from '@/components/ConnectButton';
import {
  Button,
  Chip,
  ChipRow,
  Empty,
  ErrorText,
  Header,
  Hero,
  Loading,
  ProductArt,
  Screen,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { atLeast } from '@/lib/minDuration';
import { useLightStatusBar } from '@/lib/statusBar';
import { colors, space, type, fonts } from '@/theme';

const LABEL: Record<BuyerFilter, string> = {
  ALL: 'All',
  READY: 'Ready',
  COMMITTED: 'Committed',
  INTERESTED: 'Interested',
  RECENT: 'Recently joined',
};
const ORDER: BuyerFilter[] = ['ALL', 'READY', 'COMMITTED', 'INTERESTED', 'RECENT'];

/**
 * Mockup 4 — buyers of the same item in the same city. A count, never a
 * match score; no budget anywhere (spec §14–16).
 */
export default function Buyers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  useLightStatusBar();
  const [filter, setFilter] = useState<BuyerFilter>('ALL');
  const [page, setPage] = useState<BuyerDiscoveryDto | null>(null);
  const [items, setItems] = useState<BuyerDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const firstLoad = useRef(true);

  const load = useCallback(
    async (cursor?: string) => {
      try {
        const fetchPage = async () => {
          const intent = await api.intents.get(id);
          return api.buyers.discover({
            carId: intent.car.id,
            cityId: intent.city.id,
            filter,
            cursor,
          });
        };
        // The first load holds the preloader for its minimum time; later pages don't.
        const res = firstLoad.current ? await atLeast(fetchPage()) : await fetchPage();
        firstLoad.current = false;
        setPage(res);
        setItems((prev) => (cursor ? [...prev, ...res.items] : res.items));
        setErr(null);
      } catch (e) {
        setErr(errorMessage(e));
      }
    },
    [id, filter],
  );

  useEffect(() => {
    setItems([]);
    void load();
  }, [load]);

  if (!page)
    return (
      <Screen>
        <Header />
        {err ? <ErrorText>{err}</ErrorText> : <Loading />}
      </Screen>
    );
  const total = page.totalActiveBuyers;

  return (
    <Screen
      edges={[]}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      footer={
        <Button
          variant="green"
          title="View the Collective"
          onPress={() => router.push(`/posts/${id}/collective`)}
        />
      }
    >
      <Hero>
        <Header light align="left" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[type.h1, { color: colors.white }]}>{page.car.displayName}</Text>
            <Text style={[type.body, { color: colors.onNavyMuted }]}>in {page.city.name}</Text>
          </View>
          <ProductArt car={page.car} size="md" onDark />
        </View>
        {/* The screen's one big moment: a plain count of real buyers, never a score. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.md }}>
          <Text style={s.count}>{total}</Text>
          <Text style={[type.body, { color: colors.white, flex: 1, paddingBottom: 10 }]}>
            {total === 1 ? 'other person is' : 'other people are'} looking to buy{' '}
            {page.car.displayName} in {page.city.name}
          </Text>
        </View>
      </Hero>
      <ChipRow>
        {ORDER.filter((f) => BUYER_FILTERS.includes(f)).map((f) => (
          <Chip
            key={f}
            label={f === 'RECENT' ? LABEL[f] : `${LABEL[f]} (${page.counts[f] ?? 0})`}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </ChipRow>
      {items.length === 0 ? (
        <Empty
          icon="people-outline"
          title="You're the first here"
          body={`Nobody else is looking for ${page.car.displayName} in ${page.city.name} yet. Your post is live — we'll count others as they arrive.`}
        />
      ) : (
        <View>
          {items.map((b) => (
            <BuyerRow
              key={b.buyingIntentId}
              user={b.user}
              purchaseTimeline={b.purchaseTimeline}
              intentLevel={b.intentLevel}
              action={
                <ConnectButton
                  userId={b.user.id}
                  meId={me.id}
                  connection={b.connection}
                  onChange={(c) =>
                    setItems((xs) =>
                      xs.map((x) => (x.user.id === b.user.id ? { ...x, connection: c } : x)),
                    )
                  }
                />
              }
            />
          ))}
        </View>
      )}
      {page.nextCursor ? (
        <Button
          variant="outline"
          title="View More Buyers"
          loading={more}
          onPress={async () => {
            setMore(true);
            await load(page.nextCursor!);
            setMore(false);
          }}
        />
      ) : null}
      <ErrorText>{err}</ErrorText>
    </Screen>
  );
}

const s = StyleSheet.create({
  count: {
    fontFamily: fonts.black,
    fontSize: 72,
    lineHeight: 76,
    letterSpacing: -3,
    color: colors.white,
  },
});
