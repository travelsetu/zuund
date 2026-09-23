import { Ionicons } from '@expo/vector-icons';
import type { ConversationDto } from '@zuund/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Empty, Header, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { listTime } from '@/lib/format';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type, fonts } from '@/theme';

/** Direct conversations and collective discussions, newest first. */
export default function Messages() {
  const { data, refresh, refreshing } = useFocusData(async () => {
    const [convs, cols] = await Promise.all([
      api.conversations.list(),
      api.collectives.list({ mine: true }),
    ]);
    const names = new Map(cols.items.map((c) => [c.id, `${c.car.displayName} Buyers`]));
    return { convs: convs.items, names };
  });
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header
        title="Messages"
        back={false}
        right={
          <Pressable
            onPress={() => router.push('/connections')}
            hitSlop={10}
            accessibilityLabel="Connections"
          >
            <Ionicons name="people-outline" size={23} color={colors.ink} />
          </Pressable>
        }
      />
      {!data ? (
        <Loading />
      ) : data.convs.length === 0 ? (
        <Empty
          icon="chatbubbles-outline"
          title="No messages yet"
          body="Connect with a buyer, then message them here."
        />
      ) : (
        <View>
          {data.convs.map((c) => (
            <Row
              key={c.id}
              c={c}
              title={
                c.otherUser?.name ??
                (c.collectiveId ? data.names.get(c.collectiveId) : undefined) ??
                'Conversation'
              }
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function Row({ c, title }: { c: ConversationDto; title: string }) {
  const href =
    c.type === 'COLLECTIVE' && c.collectiveId
      ? `/collectives/${c.collectiveId}/discussion`
      : `/messages/${c.id}`;
  const last = c.lastMessage;
  return (
    <Pressable style={s.row} onPress={() => router.push(href as never)} accessibilityRole="button">
      {c.otherUser ? (
        <Avatar user={c.otherUser} size={48} />
      ) : (
        <View style={s.groupIcon}>
          <Ionicons name="people" size={22} color={colors.brand} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.h3, c.unreadCount > 0 && { color: colors.brandDark }]} numberOfLines={1}>
          {title}
        </Text>
        <Text
          style={[
            type.small,
            c.unreadCount > 0 && { color: colors.text, fontFamily: fonts.semibold },
          ]}
          numberOfLines={1}
        >
          {last
            ? last.deletedAt
              ? 'Message deleted'
              : last.content || 'Attachment'
            : 'No messages yet'}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <Text style={type.tiny}>{listTime(c.updatedAt)}</Text>
        {c.unreadCount > 0 ? (
          <View style={s.unread}>
            <Text style={{ color: colors.white, fontSize: 11, fontFamily: fonts.bold }}>
              {c.unreadCount}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unread: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
});
