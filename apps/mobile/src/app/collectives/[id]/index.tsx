import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import {
  Avatar,
  Button,
  Card,
  Empty,
  Header,
  Hero,
  IconButton,
  Loading,
  Notice,
  ProductArt,
  Screen,
  sentenceCase,
  type IconName,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDate, listTime } from '@/lib/format';
import { useLightStatusBar } from '@/lib/statusBar';
import { useFocusData } from '@/lib/useAsync';
import { colors, radius, space, type, fonts } from '@/theme';

const SECTIONS: Array<{ key: string; label: string; icon: IconName }> = [
  { key: 'discussion', label: 'Discussion', icon: 'chatbubbles-outline' },
  { key: 'polls', label: 'Polls', icon: 'stats-chart-outline' },
  { key: 'files', label: 'Files', icon: 'document-text-outline' },
  { key: 'members', label: 'Members', icon: 'people-outline' },
  { key: 'activities', label: 'Activities', icon: 'calendar-outline' },
];

/** Mockup 8 — the member's hub. Every section is gated server-side on an ACTIVE membership. */
export default function CollectiveDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useLightStatusBar();
  const { data, error, refresh, refreshing } = useFocusData(async () => {
    const c = await api.collectives.get(id);
    const [recent, intent] = await Promise.all([
      c.conversationId && c.membership?.status === 'ACTIVE'
        ? api.conversations
            .messages(c.conversationId)
            .then((p) => p.items.slice(0, 4))
            .catch(() => [])
        : Promise.resolve([]),
      c.membership
        ? api.intents.get(c.membership.buyingIntentId).catch(() => null)
        : Promise.resolve(null),
    ]);
    return { c, recent, intent };
  }, [id]);

  if (!data)
    return (
      <Screen>
        <Header />
        {error ? <Text style={type.small}>{error}</Text> : <Loading />}
      </Screen>
    );
  const { c, recent, intent } = data;
  const active = c.membership?.status === 'ACTIVE';

  function leave() {
    Alert.alert(
      'Leave this collective?',
      'Your Buying Post, payment history and past messages are kept. Refunds follow ZUUND’s refund policy.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () =>
            api.collectives
              .leave(id)
              .then(() => router.dismissTo('/collectives'))
              .catch((e) => Alert.alert('Could not leave', errorMessage(e))),
        },
      ],
    );
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing} edges={[]}>
      <Hero>
        <Header
          light
          title={`${c.car.displayName} Buyers`}
          subtitle={c.city.name}
          right={
            active ? (
              <IconButton
                name="ellipsis-horizontal"
                color={colors.white}
                label="More"
                onPress={() =>
                  Alert.alert(c.name, undefined, [
                    {
                      text: 'Report collective',
                      onPress: () =>
                        api.reports
                          .create({
                            targetType: 'COLLECTIVE',
                            targetId: id,
                            reason: 'Inappropriate collective',
                          })
                          .then(() => Alert.alert('Reported'))
                          .catch(() => {}),
                    },
                    { text: 'Leave collective', style: 'destructive', onPress: leave },
                    { text: 'Cancel', style: 'cancel' },
                  ])
                }
              />
            ) : undefined
          }
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <ProductArt car={c.car} size="md" onDark />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={[type.display, { color: colors.white }]}>{c.activeMemberCount}</Text>
              <Text style={[type.body, { color: colors.onNavyMuted }]}>
                {c.activeMemberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <Text
              style={[
                type.small,
                { color: c.status === 'ACTIVE' ? '#7BE0A8' : colors.onNavyMuted },
              ]}
            >
              {c.status === 'ACTIVE' ? 'Active group' : sentenceCase(c.status)}
            </Text>
          </View>
        </View>
      </Hero>

      {!active ? (
        <Notice tone="orange" icon="lock-closed">
          {c.membership?.status === 'PENDING_PAYMENT'
            ? 'Your Buying Pass is not active yet. Pay ₹500 for your Buying Post to open the collective.'
            : 'You are not an active member of this collective.'}
        </Notice>
      ) : intent?.pass?.expiresAt ? (
        <Notice icon="ticket-outline">
          Your Buying Pass is active until {formatDate(intent.pass.expiresAt)}.
        </Notice>
      ) : null}

      {active ? (
        <>
          <View style={s.sections}>
            {SECTIONS.map((sec) => (
              <Pressable
                key={sec.key}
                style={s.section}
                onPress={() => router.push(`/collectives/${id}/${sec.key}` as never)}
                accessibilityRole="button"
              >
                <Ionicons name={sec.icon} size={24} color={colors.brand} />
                <Text style={[type.tiny, { color: colors.text, fontFamily: fonts.semibold }]}>
                  {sec.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ gap: space.sm }}>
            <Text style={type.h3}>Recent Activity</Text>
            {recent.length === 0 ? (
              <Empty
                icon="chatbubble-ellipses-outline"
                title="Quiet so far"
                body="Start the conversation — ask what variant others are considering."
              />
            ) : (
              recent.map((m) => (
                <Pressable
                  key={m.id}
                  style={s.recent}
                  onPress={() => router.push(`/collectives/${id}/discussion`)}
                >
                  <Avatar user={m.sender} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.h3}>{m.sender.name}</Text>
                    <Text style={type.small} numberOfLines={1}>
                      {m.deletedAt ? 'Message deleted' : m.content || 'Shared an attachment'}
                    </Text>
                  </View>
                  <Text style={type.tiny}>{listTime(m.createdAt)}</Text>
                </Pressable>
              ))
            )}
            <Button
              title="View All Discussions"
              onPress={() => router.push(`/collectives/${id}/discussion`)}
            />
          </View>
        </>
      ) : c.membership?.status === 'PENDING_PAYMENT' ? (
        <Button
          variant="green"
          title="Get Buying Pass — ₹500"
          onPress={() => router.push(`/posts/${c.membership!.buyingIntentId}/pay`)}
        />
      ) : null}
    </Screen>
  );
}

const s = StyleSheet.create({
  stat: { flex: 1, alignItems: 'center', paddingVertical: space.md },
  sections: { flexDirection: 'row', justifyContent: 'space-between' },
  section: {
    width: '19%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  recent: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 6 },
});
