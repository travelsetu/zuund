import { Ionicons } from '@expo/vector-icons';
import type { NotificationDto, NotificationType } from '@zuund/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Empty, Header, Loading, Screen, type IconName } from '@/components/ui';
import { api } from '@/lib/api';
import { listTime } from '@/lib/format';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type, fonts } from '@/theme';

const ICON: Partial<Record<NotificationType, IconName>> = {
  CONNECTION_REQUEST: 'person-add',
  CONNECTION_ACCEPTED: 'people',
  NEW_MESSAGE: 'chatbubble',
  NEW_POLL: 'stats-chart',
  NEW_ACTIVITY: 'calendar',
  COLLECTIVE_MEMBERSHIP: 'people-circle',
  PAYMENT_SUCCESS: 'checkmark-circle',
  PAYMENT_FAILED: 'alert-circle',
  PASS_EXPIRING: 'time',
  PASS_EXPIRED: 'ticket',
};

/** Where a notification leads, from the ids the server put in `data`. */
function target(n: NotificationDto): string | null {
  const d = (n.data ?? {}) as Record<string, string | undefined>;
  if (d.conversationId && n.type === 'NEW_MESSAGE') return `/messages/${d.conversationId}`;
  if (d.collectiveId && d.pollId) return `/collectives/${d.collectiveId}/polls/${d.pollId}`;
  if (d.collectiveId && d.activityId) return `/collectives/${d.collectiveId}/activities`;
  if (d.collectiveId) return `/collectives/${d.collectiveId}`;
  if (d.buyingIntentId) return `/posts/${d.buyingIntentId}`;
  if (n.type.startsWith('CONNECTION')) return '/connections';
  if (d.paymentId) return '/payments';
  return null;
}

export default function Notifications() {
  const { data, setData, refresh, refreshing } = useFocusData(() => api.notifications.list());
  const readAll = () =>
    api.notifications.markAllRead().then(
      () =>
        data &&
        setData({
          ...data,
          items: data.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
        }),
    );

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header
        title="Notifications"
        right={
          <Pressable onPress={readAll}>
            <Text style={{ color: colors.brand, fontFamily: fonts.semibold, fontSize: 13 }}>
              Read all
            </Text>
          </Pressable>
        }
      />
      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty icon="notifications-outline" title="You're all caught up" />
      ) : (
        <View>
          {data.items.map((n) => (
            <Pressable
              key={n.id}
              style={[s.row, !n.readAt && { backgroundColor: colors.brandSoft }]}
              onPress={() => {
                if (!n.readAt) void api.notifications.markRead(n.id);
                const to = target(n);
                if (to) router.push(to as never);
              }}
            >
              <Ionicons
                name={ICON[n.type] ?? 'notifications'}
                size={22}
                color={
                  n.type === 'PAYMENT_FAILED' || n.type === 'PASS_EXPIRED'
                    ? colors.orange
                    : colors.brand
                }
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[type.h3, { fontSize: 15 }]}>{n.title}</Text>
                <Text style={type.small}>{n.body}</Text>
              </View>
              <Text style={type.tiny}>{listTime(n.createdAt)}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.md,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
});
