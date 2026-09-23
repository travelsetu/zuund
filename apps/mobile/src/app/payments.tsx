import type { BuyingIntentDto, PaymentDto } from '@zuund/shared';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Card, Empty, Header, Loading, Screen, StatusBadge } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate, rupees } from '@/lib/format';
import { useFocusData } from '@/lib/useAsync';
import { space, type } from '@/theme';

const TONE: Record<PaymentDto['status'], 'green' | 'orange' | 'red' | 'grey'> = {
  SUCCESS: 'green',
  INITIATED: 'orange',
  PENDING: 'orange',
  FAILED: 'red',
  CANCELLED: 'grey',
  REFUNDED: 'grey',
};

/** Each ₹500 payment belongs to one Buying Post; show which. */
export default function Payments() {
  const { data, refresh, refreshing } = useFocusData(async () => {
    const [payments, intents] = await Promise.all([api.payments.list(), api.intents.list()]);
    return {
      payments: payments.items,
      intents: new Map(intents.items.map((i: BuyingIntentDto) => [i.id, i])),
    };
  });
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title="Payment History" />
      {!data ? (
        <Loading />
      ) : data.payments.length === 0 ? (
        <Empty
          icon="card-outline"
          title="No payments yet"
          body="Buying Passes you buy for your posts appear here."
        />
      ) : (
        data.payments.map((p) => {
          const post = data.intents.get(p.buyingIntentId);
          return (
            <Pressable key={p.id} onPress={() => router.push(`/posts/${p.buyingIntentId}`)}>
              <Card style={{ gap: space.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={type.h3}>Buying Pass, {rupees(p.amount)}</Text>
                  <StatusBadge label={p.status} tone={TONE[p.status]} />
                </View>
                <Text style={type.small}>
                  {post ? `${post.car.displayName}, ${post.city.name}` : 'Buying Post'}
                  {'\n'}
                  {formatDate(p.createdAt)}
                </Text>
              </Card>
            </Pressable>
          );
        })
      )}
    </Screen>
  );
}
