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
import { UpgradeCard, upgradeAlertFor } from '@/components/Plan';
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
import { api, ApiRequestError, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { atLeast } from '@/lib/minDuration';
import { useLightStatusBar } from '@/lib/statusBar';
import { colors, space, type, fonts } from '@/theme';

const LABEL: Record<BuyerFilter, string> = {
  ALL: 'All',
  READY: 'Ready to Buy',
  COMMITTED: 'Committed',
  INTERESTED: 'Interested',
  RECENT: 'Recently joined',
  ACTIVE_RECENT: 'Active recently',
};
const ORDER: BuyerFilter[] = ['ALL', 'READY', 'COMMITTED', 'INTERESTED', 'ACTIVE_RECENT', 'RECENT'];

/**
 * Mockup 4 — buyers of the same item in the same city. A count, never a
 * match score; no budget anywhere (spec §14–16). On a Free Pass everyone is listed
 * by name, but details and the filters are Elite: the chips show a lock.
 */
export default function Buyers() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  useLightStatusBar();
  const [filter, setFilter] = useState<BuyerFilter>('ALL');
  const [page, setPage] = useState<BuyerDiscoveryDto | null>(null);
  const [items, setItems] = useState<BuyerDto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  // Not joined yet: the list is for members, so offer the Buying Pass instead.
  const [locked, setLocked] = useState(false);
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
        if (e instanceof ApiRequestError && e.body?.error?.code === 'JOIN_COLLECTIVE_FIRST')
          setLocked(true);
        else setErr(errorMessage(e));
      }
    },
    [id, filter],
  );
  const elite = page?.viewerPlan === 'ELITE';

  useEffect(() => {
    setItems([]);
    void load();
  }, [load]);

  if (locked)
    return (
      <Screen
        footer={
          <Button
            variant="green"
            title="View the Collective"
            onPress={() => router.replace(`/posts/${id}/collective`)}
          />
        }
      >
        <Header />
        <Empty
          icon="lock-closed-outline"
          title="Join the collective to see other buyers"
          body="Join with your Buying Post to see who else is buying, connect and message them. Your first 15 days are free."
        />
      </Screen>
    );
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
            label={
              (f === 'ALL' || elite ? '' : '🔒 ') +
              (f === 'RECENT' ? LABEL[f] : `${LABEL[f]} (${page.counts[f] ?? 0})`)
            }
            active={filter === f}
            onPress={() =>
              f === 'ALL' || elite
                ? setFilter(f)
                : upgradeAlertFor(
                    new ApiRequestError(403, {
                      success: false,
                      error: {
                        code: 'ELITE_REQUIRED',
                        message: `The ${LABEL[f]} filter and buyer details are part of the Elite Pass`,
                      },
                    }),
                    me,
                  )
            }
          />
        ))}
      </ChipRow>
      {!elite && items.length ? (
        <UpgradeCard
          title="See buyer details and filter"
          body="Elite shows each buyer's timeline and how sure they are, who's Ready to Buy and who was active in the last 48 hours."
          buyingIntentId={id}
        />
      ) : null}
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
              trip={b.holiday}
              activeRecently={b.activeRecently}
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
