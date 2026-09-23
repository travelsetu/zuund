import { Ionicons } from '@expo/vector-icons';
import { FREE_MEMBERS_PER_COLLECTIVE, type BuyingIntentDto, type PaymentDto } from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Check, Column, Loading } from '@/components/ui';
import { api } from '@/lib/api';
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
    /** "1" when joining took one of the collective's free places: no payment to confirm. */
    free?: string;
  }>();
  const isFree = free === '1';
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  const [intent, setIntent] = useState<BuyingIntentDto | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

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
                : "We're waiting for confirmation from the payment provider. If money left your account, your Buying Pass will activate automatically — you'll get a notification."}
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
          <Text style={type.h1}>{isFree ? "You're in!" : 'Payment Successful!'}</Text>
          <Text style={[type.h2, { color: isFree ? colors.green : colors.brand }]}>
            {isFree ? 'Free place' : rupees(payment!.amount)}
          </Text>
          {isFree ? (
            <Text style={[type.small, { textAlign: 'center' }]}>
              You're one of the first {FREE_MEMBERS_PER_COLLECTIVE} members, so there's nothing to
              pay.
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
              Buying Pass:{' '}
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
            <Text style={type.h3}>You now have access to:</Text>
            <Check>Group discussions</Check>
            <Check>Members of the collective</Check>
            <Check>Polls</Check>
            <Check>Shared information and activities</Check>
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
