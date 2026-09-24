import {
  INTENT_LEVEL_LABELS,
  INTENT_LEVELS,
  PURCHASE_TIMELINE_LABELS,
  PURCHASE_TIMELINES,
  type BuyerCountDto,
} from '@zuund/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space, type } from '@/theme';
import { UpgradeCard } from './Plan';
import { Card } from './ui';

/** How the members plan, as counts per answer: what someone deciding to join wants to know. */
export function MemberPlans({
  plans,
  holiday,
  buyingIntentId,
}: {
  plans: BuyerCountDto['members'];
  holiday: boolean;
  /** For the upgrade button when the viewer isn't Elite. */
  buyingIntentId?: string | null;
}) {
  // Elite only: the server sends null to everyone else.
  if (!plans)
    return (
      <UpgradeCard
        title={holiday ? 'When members plan to book' : 'When members expect to buy'}
        body="See how many members plan to buy within 7, 15, 30 and 60 days, and how sure they are, with Elite."
        buyingIntentId={buyingIntentId}
      />
    );
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

const s = StyleSheet.create({
  countRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  countLabel: { width: 112 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.green },
  countValue: { minWidth: 24, textAlign: 'right', fontFamily: fonts.semibold, color: colors.ink },
});
