import { Ionicons } from '@expo/vector-icons';
import type { BuyingIntentDto, PaymentCheckoutDto, PaymentDto } from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { RazorpaySheet, type RazorpayResult } from '@/components/RazorpaySheet';
import {
  Button,
  Card,
  Check,
  ErrorText,
  Header,
  Loading,
  Notice,
  ProductArt,
  Screen,
  type IconName,
} from '@/components/ui';
import { api, ApiRequestError, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { rupees } from '@/lib/format';
import { clearIdempotencyKey, idempotencyKeyFor } from '@/lib/payments';
import { colors, space, type } from '@/theme';

const METHODS: Array<{ icon: IconName; label: string }> = [
  { icon: 'phone-portrait-outline', label: 'UPI (GPay, PhonePe, Paytm…)' },
  { icon: 'card-outline', label: 'Credit / Debit card' },
  { icon: 'business-outline', label: 'Net banking' },
  { icon: 'wallet-outline', label: 'Wallets' },
];

/**
 * Mockup 6 — pay ₹500 for this Buying Post (spec §70). Wording: Buying Pass,
 * never "subscription". The amount shown comes from the server's payment.
 */
export default function Pay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const [intent, setIntent] = useState<BuyingIntentDto | null>(null);
  const [checkout, setCheckout] = useState<PaymentCheckoutDto | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.intents
      .get(id)
      .then((i) => {
        if (i.pass?.status === 'ACTIVE' && i.membership?.collectiveId)
          router.replace(`/collectives/${i.membership.collectiveId}`);
        else setIntent(i);
      })
      .catch((e) => setErr(errorMessage(e)));
  }, [id]);

  /** Joins (or creates) the collective for this post, then opens or reuses the payment. */
  async function prepare(i: BuyingIntentDto): Promise<PaymentCheckoutDto | null> {
    let collectiveId = i.membership?.collectiveId;
    if (!collectiveId) {
      const existing = (await api.collectives.list({ carId: i.car.id, cityId: i.city.id }))
        .items[0];
      const col = existing
        ? await api.collectives.join(existing.id, i.id)
        : await api.collectives.create(i.id);
      // Joining took one of the free places: nothing to pay.
      if (col.membership?.status === 'ACTIVE') {
        router.replace({ pathname: '/posts/[id]/success', params: { id: i.id, free: '1' } });
        return null;
      }
      collectiveId = col.id;
    }
    const c = await api.payments.create({
      buyingIntentId: i.id,
      collectiveId,
      idempotencyKey: await idempotencyKeyFor(i.id),
    });
    setCheckout(c);
    return c;
  }

  async function finish(result: PaymentDto) {
    if (result.status === 'SUCCESS') {
      await clearIdempotencyKey(id);
      router.replace({ pathname: '/posts/[id]/success', params: { id, paymentId: result.id } });
    } else {
      router.replace({ pathname: '/posts/[id]/failed', params: { id, paymentId: result.id } });
    }
  }

  async function pay() {
    if (!intent) return;
    setBusy(true);
    setErr(null);
    try {
      const c = checkout ?? (await prepare(intent));
      if (!c) return;
      if (c.provider === 'razorpay') setSheet(true);
      else setBusy(false); // mock provider: the dev-only button below completes it
    } catch (e) {
      if (
        e instanceof ApiRequestError &&
        (e.code === 'PASS_ALREADY_ACTIVE' || e.code === 'PAYMENT_ALREADY_SUCCEEDED')
      ) {
        const i = await api.intents.get(id).catch(() => null);
        if (i?.membership?.collectiveId)
          return router.replace(`/collectives/${i.membership.collectiveId}`);
      }
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  async function onRazorpay(r: RazorpayResult) {
    setSheet(false);
    try {
      await finish(
        await api.payments.verify({
          paymentId: checkout!.payment.id,
          providerOrderId: r.razorpay_order_id,
          providerPaymentId: r.razorpay_payment_id,
          providerSignature: r.razorpay_signature,
        }),
      );
    } catch {
      // The webhook may still confirm it; the success screen polls the server.
      router.replace({
        pathname: '/posts/[id]/success',
        params: { id, paymentId: checkout!.payment.id },
      });
    }
  }

  async function simulate() {
    if (!checkout) return;
    setBusy(true);
    const orderId = checkout.checkout.orderId!;
    try {
      await finish(
        await api.payments.verify({
          paymentId: checkout.payment.id,
          providerOrderId: orderId,
          providerPaymentId: `mock_pay_${Date.now().toString(36)}`,
          providerSignature: `mock:${orderId}`,
        }),
      );
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  if (!intent)
    return (
      <Screen>
        <Header title="Payment" />
        {err ? <ErrorText>{err}</ErrorText> : <Loading />}
      </Screen>
    );
  const amount = checkout ? rupees(checkout.payment.amount) : '₹500';

  return (
    <Screen
      footer={
        checkout?.provider === 'mock' ? (
          <View style={{ gap: space.sm }}>
            <Notice tone="orange">Development payment provider. No real money moves.</Notice>
            <Button
              variant="green"
              title="Simulate successful payment"
              loading={busy}
              onPress={simulate}
            />
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <Ionicons name="shield-checkmark" size={16} color={colors.green} />
              <Text style={type.small}>Secure payment by Razorpay</Text>
            </View>
            <Button variant="green" title={`Pay ${amount}`} loading={busy} onPress={pay} />
          </View>
        )
      }
    >
      <Header title="Payment" />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <ProductArt car={intent.car} size="sm" />
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>{intent.car.displayName} Collective</Text>
          <Text style={type.small}>{intent.city.name}</Text>
        </View>
      </Card>

      <Card style={{ gap: space.md }}>
        <Text style={type.small}>Buying Pass</Text>
        <Text style={[type.hero, { color: colors.brand, fontSize: 36 }]}>{amount}</Text>
        <Text style={type.body}>
          Valid for up to 60 days from successful payment, for this Buying Post (
          {intent.car.displayName} — {intent.city.name}) only.
        </Text>
        <View style={{ gap: 10 }}>
          <Check>Collective discussion with other buyers</Check>
          <Check>Create and vote in polls</Check>
          <Check>Share brochures, links and useful information</Check>
          <Check>Plan meetups and group calls</Check>
        </View>
        <Text style={type.tiny}>One-time payment. It does not renew and is not charged again.</Text>
      </Card>

      <Card style={{ gap: space.md }}>
        <Text style={type.h3}>Pay with</Text>
        {METHODS.map((m) => (
          <View key={m.label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Ionicons name={m.icon} size={20} color={colors.brand} />
            <Text style={type.body}>{m.label}</Text>
          </View>
        ))}
        <Text style={type.tiny}>You choose the method in the secure Razorpay window.</Text>
      </Card>
      <ErrorText>{err}</ErrorText>

      <RazorpaySheet
        checkout={sheet ? checkout : null}
        prefill={{ name: me.name ?? '', email: me.email }}
        onResult={onRazorpay}
        onDismiss={() => {
          setSheet(false);
          setBusy(false);
        }}
      />
    </Screen>
  );
}
