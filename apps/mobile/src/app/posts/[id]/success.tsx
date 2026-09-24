import { Ionicons } from '@expo/vector-icons';
import { type BuyingIntentDto, type PaymentDto } from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlanFeatures } from '@/components/Plan';
import { Button, Column, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, rupees } from '@/lib/format';
import { colors, space, type, fonts } from '@/theme';

/**
 * Mockup 7 — shown only once the server reports SUCCESS (spec §71). If the
 * app got here before the webhook landed, it polls briefly.
 */
export default function PaymentSuccess() {
  const { id, paymentId, free } = useLocalSearchParams<{
    id: string;
    paymentId?: string;
    /** "1" when joining started the Free Pass: no payment to confirm. */
    free?: string;
  }>();
  const isFree = free === '1';
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [intent, setIntent] = useState<BuyingIntentDto | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const { reload } = useAuth();
  // The pass sets your limits and the 👑: refresh the signed-in user once it's active.
  useEffect(() => {
    if (intent) void reload();
  }, [intent, reload]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (isFree || !paymentId) {
        const i = await api.intents.get(id).catch(() => null);
        if (!alive) return;
        // Still show only what the server says: the pass must really be active.
        if (i?.pass?.status === 'ACTIVE') setIntent(i);
        else setGaveUp(true);
        return;
      }
      for (let attempt = 0; attempt < 10 && alive; attempt++) {
        const p = await api.payments.get(paymentId).catch(() => null);
        if (p?.status === 'SUCCESS') {
          const i = await api.intents.get(id);
          if (!alive) return;
          setPayment(p);
          setIntent(i);
          return;
        }
        if (p && (p.status === 'FAILED' || p.status === 'CANCELLED')) {
          return router.replace({ pathname: '/posts/[id]/failed', params: { id, paymentId } });
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (alive) setGaveUp(true);
    })();
    return () => {
      alive = false;
    };
  }, [id, paymentId, isFree]);

  if (!intent || (!isFree && !payment)) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: space.xl,
          gap: space.lg,
          backgroundColor: colors.white,
        }}
      >
        {gaveUp ? (
          <>
            <Text style={[type.h2, { textAlign: 'center' }]}>
              {isFree ? 'Your place is not confirmed' : 'Still confirming your payment'}
            </Text>
            <Text style={[type.body, { textAlign: 'center' }]}>
              {isFree
                ? 'Open your Buying Post to see its current status.'
                : "We're waiting for confirmation from the payment provider. If money left your account, your Elite Pass will activate automatically — you'll get a notification."}
            </Text>
            <Button title="Back to my Buying Post" onPress={() => router.replace(`/posts/${id}`)} />
          </>
        ) : (
          <>
            <Loading />
            <Text style={[type.body, { textAlign: 'center' }]}>Confirming your payment…</Text>
          </>
        )}
      </SafeAreaView>
    );
  }

  const collectiveId = intent.membership?.collectiveId;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <Column max={480}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: space.xl,
            gap: space.md,
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: colors.green,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="checkmark" size={60} color={colors.white} />
          </View>
          <Text style={type.h1}>{isFree ? "You're in!" : "You're Elite!"}</Text>
          <Text style={[type.h2, { color: isFree ? colors.green : colors.gold }]}>
            {isFree ? 'Free Pass' : `Elite Pass · ${rupees(payment!.amount)}`}
          </Text>
          {isFree ? (
            <Text style={[type.small, { textAlign: 'center' }]}>
              Nothing to pay. You can upgrade to Elite any time.
            </Text>
          ) : null}
          <Text style={[type.body, { textAlign: 'center' }]}>
            Welcome to the {intent.car.displayName} Collective{'\n'}
            {intent.city.name}
          </Text>
          <View
            style={{
              alignSelf: 'stretch',
              backgroundColor: colors.greenSoft,
              borderRadius: 12,
              padding: space.md,
              gap: 4,
            }}
          >
            <Text style={type.body}>
              {isFree ? 'Free Pass' : 'Elite Pass'}:{' '}
              <Text style={{ fontFamily: fonts.heavy, color: colors.green }}>
                {intent.pass?.status}
              </Text>
            </Text>
            <Text style={type.body}>
              Valid until:{' '}
              <Text style={{ fontFamily: fonts.bold }}>{formatDate(intent.pass?.expiresAt)}</Text>
            </Text>
          </View>
          <View style={{ alignSelf: 'stretch', gap: 10, marginTop: space.sm }}>
            <Text style={type.h3}>You now have:</Text>
            <PlanFeatures plan={isFree ? 'FREE' : 'ELITE'} />
          </View>
        </View>
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Button
            title="Go to Collective"
            onPress={() =>
              collectiveId ? router.replace(`/collectives/${collectiveId}`) : router.replace('/')
            }
          />
          <Button variant="outline" title="Back to Home" onPress={() => router.dismissTo('/')} />
        </View>
      </Column>
    </SafeAreaView>
  );
}
