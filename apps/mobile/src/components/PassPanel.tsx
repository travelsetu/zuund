import { ELITE_PASS_DAYS, FREE_PASS_DAYS, type BuyingIntentDto } from '@zuund/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { formatDate, rupees } from '@/lib/format';
import { colors, space, type, fonts } from '@/theme';
import { ELITE_PRICE, PassChip, UsageRow, goUpgrade } from './Plan';
import { Button, Card, StatusBadge } from './ui';

/**
 * Free or Elite Pass state for one post (spec §37, §73). Status and dates come from
 * the server; the app never works out expiry itself. While it's the pass that sets
 * your limits, it also shows how much of them is used.
 */
export function PassPanel({ intent }: { intent: BuyingIntentDto }) {
  const { me } = useAuth();
  const pass = intent.pass;
  const status = pass?.status;
  const tone =
    status === 'ACTIVE'
      ? 'green'
      : status === 'EXPIRED' || status === 'REFUNDED'
        ? 'grey'
        : status === 'CANCELLED'
          ? 'red'
          : 'orange';
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={type.h3}>
          {pass?.plan === 'ELITE' ? 'Elite Pass' : pass?.plan === 'FREE' ? 'Free Pass' : 'Pass'}
        </Text>
        <StatusBadge label={status ?? 'Not active'} tone={pass ? tone : 'grey'} />
      </View>
      {!pass || status === 'PENDING' || status === 'CANCELLED' ? (
        <>
          {intent.membership?.status === 'PENDING_PAYMENT' ? (
            <Text style={type.small}>
              This post has joined its collective. Your Free Pass for this car and city is used, so
              the Elite Pass ({ELITE_PRICE} for {ELITE_PASS_DAYS} days, for this Buying Post only)
              opens the discussion, polls, shared information and activities.
            </Text>
          ) : (
            <Text style={type.small}>
              {intent.freePassAvailable
                ? `Join the collective free for ${FREE_PASS_DAYS} days: the discussion, activities and demand counts. Upgrade to Elite (${ELITE_PRICE} for ${ELITE_PASS_DAYS} days) any time for buyer details, more connections and direct messages.`
                : `Your Free Pass for this car and city is used. Elite is ${ELITE_PRICE} for ${ELITE_PASS_DAYS} days, for this Buying Post only.`}
            </Text>
          )}
          {intent.status !== 'ACTIVE' ? null : intent.membership?.status === 'PENDING_PAYMENT' ? (
            <Button
              title={`Pay for Elite Pass — ${ELITE_PRICE}`}
              onPress={() => router.push(`/posts/${intent.id}/pay`)}
            />
          ) : (
            <Button
              variant="green"
              title={
                intent.freePassAvailable ? 'View collective & join free' : 'View collective & join'
              }
              onPress={() => router.push(`/posts/${intent.id}/collective`)}
            />
          )}
        </>
      ) : (
        <View style={{ gap: 6 }}>
          {status === 'ACTIVE' ? (
            <PassChip pass={pass} onUpgrade={() => goUpgrade(intent.id)} />
          ) : null}
          <Row label="Payment" value={pass.amount === 0 ? 'Free' : rupees(pass.amount)} />
          <Row label="Pass activated" value={formatDate(pass.activatedAt)} />
          <Row
            label={status === 'ACTIVE' ? 'Expires' : 'Expired'}
            value={formatDate(pass.expiresAt)}
          />
          {status === 'ACTIVE' && me?.pass?.buyingIntentId === intent.id ? (
            <View style={{ gap: space.md, marginTop: space.sm }}>
              <UsageRow
                label="Active connections"
                used={me.pass.activeConnections}
                limit={me.pass.activeConnectionsLimit}
              />
              <UsageRow
                label="Total connections"
                used={me.pass.acceptedConnections}
                limit={me.pass.acceptedConnectionsLimit}
              />
              {me.pass.plan === 'ELITE' ? (
                <Row
                  label="Messages to buyers you're not connected with"
                  value={`${me.pass.directMessagesLeft} left`}
                />
              ) : null}
            </View>
          ) : null}
          {status === 'ACTIVE' && pass.plan === 'FREE' ? (
            <Button
              title={`Upgrade to Elite — ${ELITE_PRICE}`}
              onPress={() => goUpgrade(intent.id)}
              style={{ marginTop: space.sm }}
            />
          ) : null}
          {status === 'ACTIVE' && intent.membership?.collectiveId ? (
            <Button
              title="Go to Collective"
              onPress={() => router.push(`/collectives/${intent.membership!.collectiveId}`)}
              style={{ marginTop: space.sm }}
            />
          ) : null}
          {status === 'EXPIRED' ? (
            <>
              <Text style={[type.small, { marginTop: space.sm }]}>
                Passes never renew automatically. Your post and the room history are kept.
              </Text>
              {intent.status === 'ACTIVE' ? (
                <Button
                  title={`Continue with Elite — ${ELITE_PRICE}`}
                  onPress={() => router.push(`/posts/${intent.id}/collective`)}
                />
              ) : null}
              <Button
                variant="outline"
                title="Create New Buying Post"
                onPress={() =>
                  router.push({
                    pathname: '/posts/new',
                    params: {
                      carId: intent.car.id,
                      name: intent.car.displayName,
                      category: intent.car.category,
                      segment: intent.car.segment ?? '',
                    },
                  })
                }
              />
            </>
          ) : null}
        </View>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={type.small}>{label}</Text>
      <Text style={[type.body, { fontFamily: fonts.semibold, color: colors.ink }]}>{value}</Text>
    </View>
  );
}
