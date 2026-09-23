import { FREE_MEMBERS_PER_COLLECTIVE, type BuyingIntentDto } from '@zuund/shared';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { formatDate, rupees } from '@/lib/format';
import { colors, space, type, fonts } from '@/theme';
import { Button, Card, StatusBadge } from './ui';

/**
 * Buying Pass state for one post (spec §37, §73). Status and dates come from
 * the server; the app never works out expiry itself.
 */
export function PassPanel({ intent }: { intent: BuyingIntentDto }) {
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
        <Text style={type.h3}>Buying Pass</Text>
        <StatusBadge label={status ?? 'Not active'} tone={pass ? tone : 'grey'} />
      </View>
      {!pass || status === 'PENDING' || status === 'CANCELLED' ? (
        <>
          {intent.membership?.status === 'PENDING_PAYMENT' ? (
            <Text style={type.small}>
              This post has joined its collective. A Buying Pass (₹500, for this Buying Post only)
              unlocks the discussion, polls, shared information and activities for up to 60 days.
            </Text>
          ) : (
            <Text style={type.small}>
              Unlocks the collective's discussion, polls, shared information and activities for up
              to 60 days. The first {FREE_MEMBERS_PER_COLLECTIVE} members of each collective join
              free; after that it's ₹500 for this Buying Post only.
            </Text>
          )}
          {intent.status !== 'ACTIVE' ? null : intent.membership?.status === 'PENDING_PAYMENT' ? (
            <Button
              variant="green"
              title="Pay for Buying Pass"
              onPress={() => router.push(`/posts/${intent.id}/pay`)}
            />
          ) : (
            <Button
              variant="green"
              title="View collective & join"
              onPress={() => router.push(`/posts/${intent.id}/collective`)}
            />
          )}
        </>
      ) : (
        <View style={{ gap: 6 }}>
          <Row label="Payment" value={pass.amount === 0 ? 'Free place' : rupees(pass.amount)} />
          <Row label="Pass activated" value={formatDate(pass.activatedAt)} />
          <Row
            label={status === 'ACTIVE' ? 'Expires' : 'Expired'}
            value={formatDate(pass.expiresAt)}
          />
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
                Passes never renew automatically. Still buying? Start a new Buying Post.
              </Text>
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
