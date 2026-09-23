import { Ionicons } from '@expo/vector-icons';
import {
  FREE_MEMBERS_PER_COLLECTIVE,
  PURCHASE_TIMELINE_LABELS,
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
import { colors, radius, space, type } from '@/theme';

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
    const [cols, buyers] = await Promise.all([
      api.collectives.list({ carId: intent.car.id, cityId: intent.city.id }),
      api.buyers.discover({ carId: intent.car.id, cityId: intent.city.id }),
    ]);
    return { intent, collective: cols.items[0] ?? null, buyers };
  }, [id]);

  if (!data)
    return (
      <Screen onRefresh={refresh} refreshing={refreshing}>
        <Header />
        <Loading />
      </Screen>
    );
  const { intent, collective, buyers } = data;
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
            <Button title="Join Now" onPress={() => router.push(`/posts/${id}/pay`)} />
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

      <ChipRow>
        <Chip label="About" active={tab === 'about'} onPress={() => setTab('about')} />
        <Chip
          label={`Buyers (${buyers.totalActiveBuyers})`}
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
        buyers.items.length ? (
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
