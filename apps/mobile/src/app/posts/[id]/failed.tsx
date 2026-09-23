import { Ionicons } from '@expo/vector-icons';
import type { PaymentDto } from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Column } from '@/components/ui';
import { api } from '@/lib/api';
import { colors, space, type } from '@/theme';

/** Spec §72 — nothing activates; retrying reuses the same idempotency key. */
export default function PaymentFailed() {
  const { id, paymentId } = useLocalSearchParams<{ id: string; paymentId?: string }>();
  const [payment, setPayment] = useState<PaymentDto | null>(null);
  useEffect(() => {
    if (paymentId)
      api.payments
        .get(paymentId)
        .then(setPayment)
        .catch(() => {});
  }, [paymentId]);

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
              width: 88,
              height: 88,
              borderRadius: 44,
              backgroundColor: colors.redSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={52} color={colors.red} />
          </View>
          <Text style={type.h1}>Payment unsuccessful</Text>
          <Text style={[type.body, { textAlign: 'center' }]}>
            Your Buying Pass has not been activated
            {payment ? ` (payment ${payment.status.toLowerCase()})` : ''}. If money left your
            account, it will be confirmed or returned automatically.
          </Text>
        </View>
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Button
            variant="green"
            title="Try again"
            onPress={() => router.replace(`/posts/${id}/pay`)}
          />
          <Button
            variant="outline"
            title="Back to my Buying Post"
            onPress={() => router.replace(`/posts/${id}`)}
          />
        </View>
      </Column>
    </SafeAreaView>
  );
}
