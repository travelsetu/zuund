import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { MemberPlans } from '@/components/MemberPlans';
import { BuyerPulse } from '@/components/Plan';
import { Header, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useFocusData } from '@/lib/useAsync';
import { type } from '@/theme';

/**
 * Room insights: the Live Buyer Pulse (Elite adds who's active, who's new and nearby
 * bands) and how the collective's members plan. Counts only, never who.
 */
export default function Insights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, refresh, refreshing } = useFocusData(async () => {
    const c = await api.collectives.get(id);
    const counts = await api.buyers.count({ carId: c.car.id, cityId: c.city.id });
    return { c, counts };
  }, [id]);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header
        title="Insights"
        subtitle={data ? `${data.c.car.displayName} · ${data.c.city.name}` : undefined}
      />
      {!data ? (
        error ? (
          <Text style={type.small}>{error}</Text>
        ) : (
          <Loading />
        )
      ) : (
        <>
          <BuyerPulse
            pulse={data.counts.pulse}
            buyingIntentId={data.c.membership?.buyingIntentId}
          />
          <MemberPlans
            plans={data.counts.members}
            holiday={data.c.car.category === 'HOLIDAY'}
            buyingIntentId={data.c.membership?.buyingIntentId}
          />
        </>
      )}
    </Screen>
  );
}
