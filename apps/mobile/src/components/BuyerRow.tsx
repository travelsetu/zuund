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
import { colors, space, type } from '@/theme';
import { Avatar, IntentBadge, Verified } from './ui';

/**
 * Buyer card (spec §17): name, verified, city, timeline, intent, one action.
 * Never phone, email, address or budget — the DTO doesn't carry them.
 */
export function BuyerRow({
  user,
  purchaseTimeline,
  intentLevel,
  trip,
  action,
}: {
  user: PublicUserDto;
  purchaseTimeline: PurchaseTimeline;
  intentLevel: IntentLevel;
  /** Holiday packages: when they travel, for how long, who and which hotels. */
  trip?: HolidayTripDto | null;
  action?: ReactNode;
}) {
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
          </View>
          {user.city ? <Text style={type.small}>{user.city.name}</Text> : null}
          {trip ? (
            <Text style={[type.small, { color: colors.text }]}>{formatTrip(trip)}</Text>
          ) : null}
          <Text style={type.small}>
            {trip
              ? 'Booking ' + PURCHASE_TIMELINE_LABELS[purchaseTimeline].toLowerCase()
              : PURCHASE_TIMELINE_LABELS[purchaseTimeline]}
          </Text>
        </View>
      </Pressable>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <IntentBadge level={intentLevel} />
        {action}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
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
