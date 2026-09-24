import { Ionicons } from '@expo/vector-icons';
import {
  FREE_MEMBERS_PER_COLLECTIVE,
  INTENT_LEVEL_LABELS,
  INTENT_LEVELS,
  PURCHASE_TIMELINE_LABELS,
  PURCHASE_TIMELINES,
  type BuyerCountDto,
  type BuyerDto,
} from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { BuyerRow } from '@/components/BuyerRow';
import {
  Button,
  Card,
  Check,
  Chip,
  ChipRow,
  Empty,
  Header,
  Hero,
  Loading,
  ProductArt,
  Screen,
  type IconName,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useLightStatusBar } from '@/lib/statusBar';
import { useFocusData } from '@/lib/useAsync';
import { colors, fonts, radius, space, type } from '@/theme';

type Tab = 'about' | 'buyers' | 'discussion';

/**
 * Mockup 5 — the collective for this post's item + city, seen before joining.
 * Before paying you see buyers from discovery (free); members, discussion,
 * polls and files open only with an ACTIVE Buying Pass.
 */
export default function GroupDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useLightStatusBar();
  const [tab, setTab] = useState<Tab>('about');
  const [joining, setJoining] = useState(false);
  const { data, reload, refresh, refreshing } = useFocusData(async () => {
    const intent = await api.intents.get(id);
    const scope = { carId: intent.car.id, cityId: intent.city.id };
    // Who the other buyers are is for members; everyone else sees how many there are.
    const joined = intent.membership?.status === 'ACTIVE';
    const [cols, buyers, count] = await Promise.all([
      api.collectives.list(scope),
      joined ? api.buyers.discover(scope) : Promise.resolve(null),
      joined ? Promise.resolve(null) : api.buyers.count(scope),
    ]);
    return {
      intent,
      collective: cols.items[0] ?? null,
      buyers,
      buyerCount: buyers?.totalActiveBuyers ?? count?.count ?? 0,
      memberPlans: count?.members ?? null,
    };
  }, [id]);

  if (!data)
    return (
      <Screen onRefresh={refresh} refreshing={refreshing}>
        <Header />
        <Loading />
      </Screen>
    );
  const { intent, collective, buyers, buyerCount, memberPlans } = data;
  const member = collective?.membership?.status === 'ACTIVE';
  // Before anyone has started the collective, all free places are open.
  const freeLeft = collective ? collective.freePlacesLeft : FREE_MEMBERS_PER_COLLECTIVE;

  async function joinFree() {
    setJoining(true);
    try {
      const col = collective
        ? await api.collectives.join(collective.id, intent.id)
        : await api.collectives.create(intent.id);
      if (col.membership?.status === 'ACTIVE') {
        router.replace({ pathname: '/posts/[id]/success', params: { id, free: '1' } });
      } else {
        // The last free place went to someone else a moment ago.
        Alert.alert('Free places just ran out', 'You can still join with a ₹500 Buying Pass.', [
          { text: 'Not now', style: 'cancel', onPress: () => void reload() },
          { text: 'Continue', onPress: () => router.push(`/posts/${id}/pay`) },
        ]);
      }
    } catch (e) {
      Alert.alert('Could not join', errorMessage(e));
    } finally {
      setJoining(false);
    }
  }
  const name = `${intent.car.displayName} Buyers`;

  return (
    <Screen
      onRefresh={refresh}
      refreshing={refreshing}
      edges={[]}
      footer={
        member ? (
          <Button
            title="Go to Collective"
            onPress={() => router.replace(`/collectives/${collective!.id}`)}
          />
        ) : intent.status !== 'ACTIVE' ? (
          <Text style={[type.small, { textAlign: 'center' }]}>
            Resume this Buying Post to join its collective.
          </Text>
        ) : freeLeft > 0 ? (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={[type.hero, { color: colors.green }]}>Free</Text>
              <Text style={[type.small, { flex: 1 }]}>
                {freeLeft} of {FREE_MEMBERS_PER_COLLECTIVE} free places left. Then ₹500 per Buying
                Post.
              </Text>
            </View>
            <Button variant="green" title="Join free" loading={joining} onPress={joinFree} />
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
              <Text style={[type.hero, { color: colors.brand }]}>₹500</Text>
              <Text style={type.small}>Buying Pass for this Buying Post only</Text>
            </View>
            <Button
              title={
                collective?.membership?.status === 'PENDING_PAYMENT'
                  ? 'Pay for Buying Pass'
                  : 'Join Now'
              }
              onPress={() => router.push(`/posts/${id}/pay`)}
            />
          </View>
        )
      }
    >
      <Hero>
        <Header light />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <ProductArt car={intent.car} size="lg" onDark />
          <Text
            style={[type.h1, { marginTop: space.sm, textAlign: 'center', color: colors.white }]}
          >
            {name}
          </Text>
          <Text style={[type.body, { color: colors.onNavyMuted }]}>{intent.city.name}</Text>
        </View>
      </Hero>

      <View style={s.stats}>
        <Stat icon="people" value={String(collective?.activeMemberCount ?? 0)} label="Members" />
        <Stat icon="location" value={intent.city.name} label="Location" />
        <Stat
          icon="time"
          value={PURCHASE_TIMELINE_LABELS[intent.purchaseTimeline]}
          label="Your timeline"
        />
      </View>

      {!member && memberPlans ? (
        <MemberPlans plans={memberPlans} holiday={intent.car.category === 'HOLIDAY'} />
      ) : null}

      <ChipRow>
        <Chip label="About" active={tab === 'about'} onPress={() => setTab('about')} />
        <Chip
          label={`Buyers (${buyerCount})`}
          active={tab === 'buyers'}
          onPress={() => setTab('buyers')}
        />
        <Chip
          label="Discussions"
          active={tab === 'discussion'}
          onPress={() => setTab('discussion')}
        />
      </ChipRow>

      {tab === 'about' ? (
        <Card style={{ gap: space.md }}>
          <Text style={type.body}>
            A group for people planning to buy {intent.car.displayName} in {intent.city.name}. Join
            to talk with other buyers, run polls, share useful information and make a
            better-informed decision together. Each member buys individually.
          </Text>
          <Check>Members are buyers with an active Buying Pass</Check>
          <Check>Private discussion — WhatsApp numbers stay hidden</Check>
          <Check>No dealers or sellers inside the collective</Check>
        </Card>
      ) : tab === 'buyers' ? (
        !buyers ? (
          <Empty
            icon="lock-closed-outline"
            title={
              buyerCount
                ? `${buyerCount} ${buyerCount === 1 ? 'buyer' : 'buyers'} in this collective`
                : 'No other buyers yet'
            }
            body="Join the collective to see who they are, connect and message them."
          />
        ) : buyers.items.length ? (
          <View>
            {buyers.items.map((b: BuyerDto) => (
              <BuyerRow
                key={b.buyingIntentId}
                user={b.user}
                purchaseTimeline={b.purchaseTimeline}
                intentLevel={b.intentLevel}
              />
            ))}
            {buyers.nextCursor ? (
              <Button
                variant="ghost"
                title="See all buyers"
                onPress={() => router.push(`/posts/${id}/buyers`)}
              />
            ) : null}
          </View>
        ) : (
          <Empty icon="people-outline" title="No other buyers yet" />
        )
      ) : (
        <Empty
          icon="lock-closed-outline"
          title="Members only"
          body={
            member
              ? 'Open the collective to see the discussion.'
              : 'Discussion, polls and shared files open once your Buying Pass is active.'
          }
        />
      )}
    </Screen>
  );
}

/** How the members plan, as counts per answer: what someone deciding to join wants to know. */
function MemberPlans({ plans, holiday }: { plans: BuyerCountDto['members']; holiday: boolean }) {
  const total = INTENT_LEVELS.reduce((n, l) => n + plans.byIntentLevel[l], 0);
  return (
    <Card style={{ gap: space.lg }}>
      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>
          {holiday ? 'When they plan to book' : 'When they expect to buy'}
        </Text>
        {PURCHASE_TIMELINES.map((t) => (
          <CountRow
            key={t}
            label={PURCHASE_TIMELINE_LABELS[t]}
            count={plans.byTimeline[t]}
            total={total}
          />
        ))}
      </View>
      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>How sure they are</Text>
        {INTENT_LEVELS.map((l) => (
          <CountRow
            key={l}
            label={INTENT_LEVEL_LABELS[l]}
            count={plans.byIntentLevel[l]}
            total={total}
          />
        ))}
      </View>
      {total ? null : <Text style={type.tiny}>No members yet. Be the first to join.</Text>}
    </Card>
  );
}

function CountRow({ label, count, total }: { label: string; count: number; total: number }) {
  return (
    <View
      style={s.countRow}
      accessible
      accessibilityLabel={`${label}: ${count} ${count === 1 ? 'member' : 'members'}`}
    >
      <Text style={[type.small, s.countLabel]}>{label}</Text>
      <View style={s.track}>
        <View style={[s.fill, { width: `${total ? (count / total) * 100 : 0}%` }]} />
      </View>
      <Text style={[type.small, s.countValue]}>{count}</Text>
    </View>
  );
}

function Stat({ icon, value, label }: { icon: IconName; value: string; label: string }) {
  return (
    <View style={s.stat}>
      <Ionicons name={icon} size={20} color={colors.green} />
      <Text style={[type.h3, { textAlign: 'center' }]} numberOfLines={2}>
        {value}
      </Text>
      <Text style={type.tiny}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  countRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  countLabel: { width: 112 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.green },
  countValue: { minWidth: 24, textAlign: 'right', fontFamily: fonts.semibold, color: colors.ink },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
});
