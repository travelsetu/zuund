import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { InsightsPanel } from '@/components/InsightsPanel';
import { Header, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useFocusData } from '@/lib/useAsync';
import { type } from '@/theme';

/** The collective hub's Insights: see InsightsPanel. */
export default function Insights() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: c, error, refresh, refreshing } = useFocusData(() => api.collectives.get(id), [id]);

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title="Insights" subtitle={c ? `${c.car.displayName} · ${c.city.name}` : undefined} />
      {!c ? (
        error ? (
          <Text style={type.small}>{error}</Text>
        ) : (
          <Loading />
        )
      ) : (
        <InsightsPanel
          car={c.car}
          cityId={c.city.id}
          buyingIntentId={c.membership?.buyingIntentId}
          joined={c.membership?.status === 'ACTIVE'}
        />
      )}
    </Screen>
  );
}
