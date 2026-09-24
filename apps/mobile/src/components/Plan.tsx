import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  ELITE_PASS_AMOUNT_PAISE,
  ELITE_PASS_DAYS,
  FREE_PASS_DAYS,
  PLAN_LIMITS,
  type BuyerPulseDto,
  type BuyingPassDto,
  type MeDto,
} from '@zuund/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { ApiRequestError } from '@/lib/api';
import { daysLeft, rupees } from '@/lib/format';
import { colors, fonts, radius, space, type } from '@/theme';
import { Button, Card, Check } from './ui';

export const ELITE_PRICE = rupees(ELITE_PASS_AMOUNT_PAISE);

/** What Free includes, as the plan cards list it. */
export const FREE_FEATURES = [
  `${FREE_PASS_DAYS} days validity`,
  `${PLAN_LIMITS.FREE.activeConnections} active connections`,
  `${PLAN_LIMITS.FREE.acceptedConnections} total connections`,
  'Join the virtual room and its discussion',
  'See demand counts',
  'Create and join activities',
];

/** What Elite adds: the reasons to upgrade. */
export const ELITE_FEATURES = [
  `${ELITE_PASS_DAYS} days validity`,
  `${PLAN_LIMITS.ELITE.activeConnections} active connections`,
  `${PLAN_LIMITS.ELITE.acceptedConnections} total connections`,
  `Message buyers you're not connected with (${PLAN_LIMITS.ELITE.directMessages} per pass)`,
  'See buyer details: timeline and how sure they are',
  'Filters: Ready to Buy, Committed, active recently',
  'Live Buyer Pulse: who was active in the last 48 hours',
  'Elite badge',
];

/** 👑 next to the name of someone holding an active Elite Pass. */
export function EliteBadge({ small }: { small?: boolean }) {
  return (
    <View
      style={[s.elite, small && { paddingHorizontal: 5, paddingVertical: 1 }]}
      accessibilityLabel="Elite member"
    >
      <MaterialCommunityIcons name="crown" size={small ? 11 : 13} color={colors.gold} />
      {small ? null : <Text style={s.eliteText}>Elite</Text>}
    </View>
  );
}

/** Where "Upgrade to Elite" goes: the pay screen of the post whose pass sets your limits. */
export function goUpgrade(buyingIntentId?: string | null) {
  if (buyingIntentId) router.push(`/posts/${buyingIntentId}/pay`);
  else router.push('/my-posts');
}

/**
 * Turns a plan-limit error into an "Upgrade to Elite" prompt. Returns false for any
 * other error, so the caller can show it the usual way.
 */
export function upgradeAlertFor(e: unknown, me: MeDto | null | undefined): boolean {
  if (!(e instanceof ApiRequestError)) return false;
  const onElite = me?.pass?.plan === 'ELITE';
  const title =
    e.code === 'ELITE_REQUIRED'
      ? 'Part of the Elite Pass'
      : e.code === 'CONNECTION_LIMIT' || e.code === 'ACCEPTED_LIMIT'
        ? 'Connection limit reached'
        : e.code === 'DM_CREDITS_USED'
          ? 'Message credits used'
          : null;
  if (!title) return false;
  if (onElite) {
    Alert.alert(title, e.message);
    return true;
  }
  const why = e.code === 'ELITE_REQUIRED' ? e.message : `${e.message}. Elite raises the limits`;
  Alert.alert(title, `${why}. Elite is ${ELITE_PRICE} for ${ELITE_PASS_DAYS} days.`, [
    { text: 'Not now', style: 'cancel' },
    { text: 'Upgrade to Elite', onPress: () => goUpgrade(me?.pass?.buyingIntentId) },
  ]);
  return true;
}

/** "Free Pass Active · 12 days left · Upgrade" / "Elite Pass Active · 28 days left". */
export function PassChip({
  pass,
  onUpgrade,
}: {
  pass: Pick<BuyingPassDto, 'plan' | 'status' | 'expiresAt'>;
  onUpgrade?: () => void;
}) {
  const elite = pass.plan === 'ELITE';
  const left = daysLeft(pass.expiresAt);
  const active = pass.status === 'ACTIVE';
  return (
    <View style={s.chipRow}>
      <View style={[s.chip, { backgroundColor: elite ? colors.goldSoft : colors.greenSoft }]}>
        {elite ? (
          <MaterialCommunityIcons name="crown" size={13} color={colors.gold} />
        ) : (
          <View style={[s.dot, { backgroundColor: colors.green }]} />
        )}
        <Text style={[s.chipText, { color: elite ? colors.gold : colors.green }]}>
          {elite ? 'Elite Pass' : 'Free Pass'} {active ? 'Active' : 'ended'}
        </Text>
      </View>
      {active && left !== null ? (
        <View style={[s.chip, { backgroundColor: colors.canvas }]}>
          <Text style={[s.chipText, { color: colors.muted }]}>
            {left} {left === 1 ? 'day' : 'days'} left
          </Text>
        </View>
      ) : null}
      {onUpgrade ? (
        <Pressable
          onPress={onUpgrade}
          style={({ pressed }) => [s.upgrade, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Text style={[s.chipText, { color: colors.brand }]}>{elite ? 'Extend' : 'Upgrade'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "5 active connections (3/5)" with a bar. */
export function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit ? Math.min(1, used / limit) : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={type.body}>{label}</Text>
        <Text style={[type.body, { fontFamily: fonts.semibold, color: colors.ink }]}>
          {used}/{limit}
        </Text>
      </View>
      <View style={s.track}>
        <View
          style={[
            s.fill,
            { width: `${pct * 100}%`, backgroundColor: pct >= 1 ? colors.orange : colors.green },
          ]}
        />
      </View>
    </View>
  );
}

/** The locked panel Free users see where Elite has more: title, what it unlocks, one button. */
export function UpgradeCard({
  title,
  body,
  buyingIntentId,
}: {
  title: string;
  body?: string;
  buyingIntentId?: string | null;
}) {
  return (
    <View style={s.locked}>
      <Ionicons name="lock-closed" size={22} color={colors.purple} />
      <Text style={[type.h3, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.small, { textAlign: 'center' }]}>{body}</Text> : null}
      <Button
        title={`Upgrade to Elite — ${ELITE_PRICE}`}
        onPress={() => goUpgrade(buyingIntentId)}
        style={{ alignSelf: 'stretch' }}
      />
    </View>
  );
}

/**
 * Live Buyer Pulse: how many are buying, how sure they are and who was active in the
 * last 48 hours. Elite adds Ready-to-Buy buyers active recently and new this week.
 */
export function BuyerPulse({
  pulse,
  buyingIntentId,
}: {
  pulse: BuyerPulseDto;
  buyingIntentId?: string | null;
}) {
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="pulse" size={18} color={colors.green} />
        <Text style={[type.h3, { flex: 1 }]}>Live Buyer Pulse</Text>
        {pulse.elite ? <EliteBadge /> : null}
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <PulseStat icon="people" value={pulse.byIntentLevel.INTERESTED} label="Interested" />
        <PulseStat icon="flag" value={pulse.byIntentLevel.COMMITTED} label="Committed" />
        <PulseStat icon="cart" value={pulse.byIntentLevel.READY} label="Ready to Buy" />
      </View>
      <PulseLine
        color={colors.green}
        text={`${pulse.activeRecently} active in the last 48 hours`}
      />
      {pulse.elite ? (
        <>
          <PulseLine
            color={colors.orange}
            text={`${pulse.readyActiveRecently ?? 0} Ready-to-Buy buyers active recently`}
          />
          <PulseLine
            color={colors.brand}
            text={`+${pulse.newThisWeek ?? 0} new buyers this week`}
          />
        </>
      ) : (
        <Pressable
          onPress={() => goUpgrade(buyingIntentId)}
          style={({ pressed }) => [s.teaser, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <Ionicons name="lock-closed" size={14} color={colors.purple} />
          <Text style={[type.small, { flex: 1, color: colors.text }]}>
            See which Ready-to-Buy buyers are active and who&apos;s new this week with Elite.
          </Text>
          <Text style={[type.small, { color: colors.brand, fontFamily: fonts.semibold }]}>
            Upgrade
          </Text>
        </Pressable>
      )}
    </Card>
  );
}

function PulseStat({
  icon,
  value,
  label,
}: {
  icon: 'people' | 'flag' | 'cart';
  value: number;
  label: string;
}) {
  const color = icon === 'people' ? colors.brand : icon === 'flag' ? colors.orange : colors.green;
  return (
    <View style={s.stat}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={[type.h2, { fontSize: 20 }]}>{value}</Text>
      </View>
      <Text style={type.tiny}>{label}</Text>
    </View>
  );
}

function PulseLine({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={type.body}>{text}</Text>
    </View>
  );
}

/** Free vs Elite checklist, for the upgrade screen and pass cards. */
export function PlanFeatures({ plan }: { plan: 'FREE' | 'ELITE' }) {
  return (
    <View style={{ gap: 10 }}>
      {(plan === 'ELITE' ? ELITE_FEATURES : FREE_FEATURES).map((f) => (
        <Check key={f}>{f}</Check>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  elite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.goldSoft,
  },
  eliteText: { color: colors.gold, fontSize: 12, fontFamily: fonts.bold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  chipText: { fontSize: 12, fontFamily: fonts.semibold },
  upgrade: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  locked: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.purpleSoft,
  },
  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.purpleSoft,
  },
  stat: {
    flex: 1,
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: colors.canvas,
  },
});
