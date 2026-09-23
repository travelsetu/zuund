import {
  INTENT_LEVELS,
  INTENT_LEVEL_LABELS,
  PURCHASE_TIMELINES,
  PURCHASE_TIMELINE_LABELS,
  HOTEL_CATEGORY_LABELS,
  formatTravelDates,
  formatTravellers,
  type HolidayDetailsDto,
  type IntentLevel,
  type PurchaseTimeline,
} from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { INTENT_HELP, Option } from '@/components/Option';
import { PassPanel } from '@/components/PassPanel';
import {
  Button,
  Card,
  Header,
  IntentBadge,
  Loading,
  ProductArt,
  Screen,
  StatusBadge,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type } from '@/theme';

/** One Buying Post: its timeline, intent (with history), status and Buying Pass. */
export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, setData, refresh, refreshing, error } = useFocusData(async () => {
    const [intent, history] = await Promise.all([api.intents.get(id), api.intents.history(id)]);
    return { intent, history };
  }, [id]);
  const [busy, setBusy] = useState(false);

  if (!data)
    return (
      <Screen>
        <Header title="Buying Post" />
        {error ? <Text style={type.small}>{error}</Text> : <Loading />}
      </Screen>
    );
  const { intent, history } = data;
  const editable = intent.status === 'ACTIVE' || intent.status === 'PAUSED';

  const act = async (fn: () => Promise<typeof intent>) => {
    setBusy(true);
    try {
      const next = await fn();
      const h = await api.intents.history(id).catch(() => history);
      setData({ intent: next, history: h });
    } catch (e) {
      Alert.alert('Could not update', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title="Buying Post" />
      <Card style={{ alignItems: 'center', gap: space.sm }}>
        <ProductArt car={intent.car} size="md" />
        <Text style={type.h1}>{intent.car.displayName}</Text>
        <Text style={type.body}>
          {intent.holiday
            ? `From ${intent.city.name}, booking ${PURCHASE_TIMELINE_LABELS[intent.purchaseTimeline].toLowerCase()}`
            : `${intent.city.name}, buying ${PURCHASE_TIMELINE_LABELS[intent.purchaseTimeline].toLowerCase()}`}
        </Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <IntentBadge level={intent.intentLevel} />
          <StatusBadge
            label={intent.status}
            tone={
              intent.status === 'ACTIVE' ? 'green' : intent.status === 'PAUSED' ? 'orange' : 'grey'
            }
          />
        </View>
        {intent.status === 'ACTIVE' ? (
          <Button
            title="See other buyers"
            icon="people-outline"
            onPress={() => router.push(`/posts/${id}/buyers`)}
            style={{ alignSelf: 'stretch', marginTop: space.sm }}
          />
        ) : null}
      </Card>

      {intent.holiday ? <TripCard trip={intent.holiday} /> : null}

      <PassPanel intent={intent} />

      {editable ? (
        <>
          <View style={{ gap: space.sm }}>
            <Text style={type.h3}>{intent.holiday ? 'Booking timeline' : 'Buying timeline'}</Text>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                rowGap: space.sm,
              }}
            >
              {PURCHASE_TIMELINES.map((t: PurchaseTimeline) => (
                <Option
                  key={t}
                  half
                  title={PURCHASE_TIMELINE_LABELS[t]}
                  on={intent.purchaseTimeline === t}
                  onPress={() =>
                    t !== intent.purchaseTimeline && act(() => api.intents.updateTimeline(id, t))
                  }
                />
              ))}
            </View>
          </View>
          <View style={{ gap: space.sm }}>
            <Text style={type.h3}>Intent level</Text>
            {INTENT_LEVELS.map((l: IntentLevel) => (
              <Option
                key={l}
                on={intent.intentLevel === l}
                title={INTENT_LEVEL_LABELS[l]}
                body={INTENT_HELP[l]}
                onPress={() =>
                  l !== intent.intentLevel && act(() => api.intents.changeLevel(id, l))
                }
              />
            ))}
          </View>
        </>
      ) : null}

      {history.length > 0 ? (
        <Card style={{ gap: 6 }}>
          <Text style={type.h3}>Intent history</Text>
          {history.map((h) => (
            <Text key={h.id} style={type.small}>
              {formatDate(h.changedAt)} —{' '}
              {h.previousLevel ? `${INTENT_LEVEL_LABELS[h.previousLevel]} → ` : ''}
              {INTENT_LEVEL_LABELS[h.newLevel]}
            </Text>
          ))}
        </Card>
      ) : null}

      {editable ? (
        <View style={{ gap: space.sm }}>
          {intent.status === 'ACTIVE' ? (
            <Button
              variant="outline"
              title="Pause post"
              loading={busy}
              onPress={() => act(() => api.intents.transition(id, 'PAUSE'))}
            />
          ) : (
            <Button
              variant="outline"
              title="Resume post"
              loading={busy}
              onPress={() => act(() => api.intents.transition(id, 'RESUME'))}
            />
          )}
          <Button
            variant="danger"
            title="Close post"
            onPress={() =>
              Alert.alert(
                'Close this Buying Post?',
                'It stays in your history but other buyers will no longer see it.',
                [
                  { text: 'Keep', style: 'cancel' },
                  {
                    text: 'Close',
                    style: 'destructive',
                    onPress: () => act(() => api.intents.transition(id, 'CLOSE')),
                  },
                ],
              )
            }
          />
        </View>
      ) : null}
    </Screen>
  );
}

/** The holiday's plan: dates, length, who travels (children's ages too: this is the owner's view). */
function TripCard({ trip }: { trip: HolidayDetailsDto }) {
  const rows: [string, string][] = [
    [
      'Travel dates',
      `Week ${trip.travelWeek}: ${formatTravelDates(trip.travelMonth, trip.travelWeek)}`,
    ],
    ['Nights', String(trip.nights)],
    [
      'Travellers',
      formatTravellers(trip.adults, trip.childAges.length) +
        (trip.childAges.length
          ? ` (${trip.childAges.length === 1 ? 'age' : 'ages'} ${trip.childAges.join(', ')})`
          : ''),
    ],
    ['Hotel', HOTEL_CATEGORY_LABELS[trip.hotelCategory]],
  ];
  return (
    <Card style={{ gap: space.md }}>
      <Text style={type.h3}>Your trip</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={{ flexDirection: 'row', gap: space.md }}>
          <Text style={[type.small, { width: 96 }]}>{label}</Text>
          <Text style={[type.body, { flex: 1, color: colors.ink }]}>{value}</Text>
        </View>
      ))}
    </Card>
  );
}
