import {
  PURCHASE_TIMELINE_LABELS,
  formatTrip,
  type HolidayTripDto,
  type IntentLevel,
  type PublicUserDto,
  type PurchaseTimeline,
} from '@zuund/shared';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, type } from '@/theme';
import { EliteBadge } from './Plan';
import { Avatar, IntentBadge, Verified } from './ui';

/**
 * Buyer card (spec §17): name, verified, city, timeline, intent, one action.
 * Never phone, email, address or budget — the DTO doesn't carry them. A Free viewer
 * gets no timeline or intent (null): the card says those are Elite.
 */
export function BuyerRow({
  user,
  purchaseTimeline,
  intentLevel,
  trip,
  activeRecently,
  action,
}: {
  user: PublicUserDto;
  purchaseTimeline: PurchaseTimeline | null;
  intentLevel: IntentLevel | null;
  /** Holiday packages: when they travel, for how long, who and which hotels. */
  trip?: HolidayTripDto | null;
  /** Elite viewers only: active in the last 48 hours. */
  activeRecently?: boolean | null;
  action?: ReactNode;
}) {
  const locked = !intentLevel;
  return (
    <View style={s.row}>
      {/* Only the identity part opens the profile, so the action button isn't nested inside another button. */}
      <Pressable
        style={({ pressed }) => [s.who, pressed && { opacity: 0.7 }]}
        onPress={() => router.push(`/users/${user.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${user.name ?? 'Buyer'} profile`}
      >
        <Avatar user={user} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[type.h3, { flexShrink: 1 }]} numberOfLines={1}>
              {user.name ?? 'ZUUND buyer'}
            </Text>
            {user.verificationStatus === 'VERIFIED' ? <Verified small /> : null}
            {user.elite ? <EliteBadge small /> : null}
          </View>
          {user.city ? <Text style={type.small}>{user.city.name}</Text> : null}
          {trip ? (
            <Text style={[type.small, { color: colors.text }]}>{formatTrip(trip)}</Text>
          ) : null}
          {purchaseTimeline ? (
            <Text style={type.small}>
              {trip
                ? 'Booking ' + PURCHASE_TIMELINE_LABELS[purchaseTimeline].toLowerCase()
                : PURCHASE_TIMELINE_LABELS[purchaseTimeline]}
            </Text>
          ) : null}
          {locked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="lock-closed" size={12} color={colors.purple} />
              <Text style={[type.tiny, { color: colors.purple }]}>Details with Elite</Text>
            </View>
          ) : null}
          {activeRecently ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={s.live} />
              <Text style={[type.tiny, { color: colors.green }]}>Active recently</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        {intentLevel ? <IntentBadge level={intentLevel} /> : null}
        {action}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  live: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.green },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});
