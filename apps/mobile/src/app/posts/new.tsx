import {
  INTENT_LEVELS,
  INTENT_LEVEL_LABELS,
  PURCHASE_TIMELINES,
  PURCHASE_TIMELINE_LABELS,
  type CityDto,
  type GeoPoint,
  type IntentLevel,
  type ProductCategory,
  type PurchaseTimeline,
} from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { CityPicker } from '@/components/CityPicker';
import {
  EMPTY_TRIP,
  HolidayTripForm,
  tripProblem,
  type HolidayTripDraft,
} from '@/components/HolidayTripForm';
import { INTENT_HELP, Option } from '@/components/Option';
import { Button, Card, ErrorText, Header, ProductArt, Screen } from '@/components/ui';
import { Ionicons } from '@expo/vector-icons';
import { devicePosition, suggestedCity } from '@/lib/location';
import { api, ApiRequestError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { returnAfterSignIn, saveDraft, takeDraft } from '@/lib/returnTo';
import { colors, space, type } from '@/theme';

/** What a guest filled in, kept while they sign in or up. */
interface Draft {
  carId: string;
  city: CityDto | null;
  position: GeoPoint | null;
  timeline: PurchaseTimeline | null;
  level: IntentLevel | null;
  trip: HolidayTripDraft;
}

/**
 * Steps 4–6: city, buying timeline, intent → create the Buying Post (free).
 * Guests can fill it in; "Create" asks them to sign in or up, then creates the post
 * straight away (`resume`).
 */
export default function NewPost() {
  const { me } = useAuth();
  const p = useLocalSearchParams<{
    carId: string;
    name: string;
    category: ProductCategory;
    segment?: string;
    resume?: string;
  }>();
  const [draft] = useState(() => {
    if (!p.resume || !me) return null;
    const d = takeDraft<Draft>();
    return d?.carId === p.carId ? d : null;
  });
  const [city, setCity] = useState<CityDto | null>(draft?.city ?? me?.city ?? null);

  // Where the buyer is, to find buyers near them: the device's position when they allow
  // it, else the server uses the IP address. The nearest city is pre-selected (unless the
  // profile already has one); the user confirms or changes it.
  const [position, setPosition] = useState<GeoPoint | null>(draft?.position ?? null);
  const [locating, setLocating] = useState(true);
  const found = async (pos: GeoPoint | null) => {
    setPosition(pos);
    setLocating(false);
    const suggested = await suggestedCity(pos).catch(() => null);
    if (suggested) setCity((c) => c ?? suggested);
  };
  const locate = () => {
    setLocating(true);
    void devicePosition().then(found);
  };
  useEffect(() => {
    void devicePosition().then(found);
  }, []);
  const [timeline, setTimeline] = useState<PurchaseTimeline | null>(draft?.timeline ?? null);
  const holiday = p.category === 'HOLIDAY';
  const [trip, setTrip] = useState<HolidayTripDraft>(draft?.trip ?? EMPTY_TRIP);
  // Nothing pre-selected: the buyer chooses both the timeline and how sure they are.
  const [level, setLevel] = useState<IntentLevel | null>(draft?.level ?? null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!city || !timeline) return setErr('Choose a city and a buying timeline');
    if (!level) return setErr('Choose how sure you are');
    const problem = holiday ? tripProblem(trip) : null;
    if (problem) return setErr(problem);
    if (!me) {
      // The one place a guest is asked to sign in: keep the form, then create it right after.
      saveDraft<Draft>({ carId: p.carId, city, position, timeline, level, trip });
      returnAfterSignIn(
        `/posts/new?${new URLSearchParams({
          carId: p.carId,
          name: p.name,
          category: p.category,
          segment: p.segment ?? '',
          resume: '1',
        })}`,
      );
      router.push('/register');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const post = await api.intents.create({
        carId: p.carId,
        cityId: city.id,
        purchaseTimeline: timeline,
        intentLevel: level,
        ...(position ? { location: position } : {}),
        ...(holiday
          ? {
              holiday: {
                travelMonth: trip.travelMonth!,
                travelWeek: trip.travelWeek!,
                adults: trip.adults!,
                childAges: trip.childAges! as number[],
                nights: trip.nights!,
                hotelCategory: trip.hotelCategory!,
              },
            }
          : {}),
      });
      // The post is free; joining its collective (and the Buying Pass) is the next step.
      router.dismissTo('/');
      router.push(`/posts/${post.id}/collective`);
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiRequestError && e.code === 'DUPLICATE_ACTIVE_POST') {
        const mine = await api.intents.list().catch(() => null);
        const existing = mine?.items.find(
          (i) => i.car.id === p.carId && i.city.id === city.id && i.status === 'ACTIVE',
        );
        Alert.alert(
          'You already have this Buying Post',
          `${p.name} in ${city.name} is already active.`,
          [
            { text: 'OK', style: 'cancel' },
            ...(existing
              ? [{ text: 'Open it', onPress: () => router.replace(`/posts/${existing.id}`) }]
              : []),
          ],
        );
        return;
      }
      setErr(errorMessage(e));
    }
  }

  // Back from signing in or up: create the post they already filled in.
  useEffect(() => {
    if (!draft) return;
    const t = setTimeout(() => void create(), 0);
    return () => clearTimeout(t);
    // Once, with the restored form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen
      footer={
        <Button
          title="Create Buying Post"
          onPress={create}
          loading={busy}
          disabled={!city || !timeline || !level}
        />
      }
    >
      <Header title="Create Buying Post" />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <ProductArt
          car={{ category: p.category, imageUrl: null, segment: p.segment || null }}
          size="sm"
        />
        <View style={{ flex: 1 }}>
          <Text style={type.small}>Looking to buy</Text>
          <Text style={type.h2}>{p.name}</Text>
          {p.segment ? <Text style={type.small}>{p.segment}</Text> : null}
        </View>
      </Card>

      <CityPicker
        label={p.category === 'HOLIDAY' ? 'Travelling from' : 'City'}
        value={city}
        onChange={setCity}
      />
      <View style={s.locationLine}>
        <Ionicons
          name={position ? 'location' : 'location-outline'}
          size={16}
          color={position ? colors.green : colors.muted}
        />
        <Text style={[type.small, { flex: 1 }]}>
          {locating
            ? 'Finding where you are, to show buyers near you…'
            : position
              ? 'Using your location to find buyers near you. Others only ever see a range like “within 10 km”.'
              : "Location is off, so we'll use an approximate location from your internet connection."}
        </Text>
        {!locating && !position ? (
          <Button small variant="ghost" title="Use my location" onPress={locate} />
        ) : null}
      </View>

      {holiday ? <HolidayTripForm value={trip} onChange={setTrip} /> : null}

      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>
          {holiday ? 'When do you plan to book?' : 'When do you expect to buy?'}
        </Text>
        <View style={s.grid}>
          {PURCHASE_TIMELINES.map((t) => (
            <Option
              key={t}
              on={timeline === t}
              onPress={() => setTimeline(t)}
              title={PURCHASE_TIMELINE_LABELS[t]}
              half
            />
          ))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>How sure are you?</Text>
        {INTENT_LEVELS.map((l) => (
          <Option
            key={l}
            on={level === l}
            onPress={() => setLevel(l)}
            title={INTENT_LEVEL_LABELS[l]}
            body={INTENT_HELP[l]}
          />
        ))}
        <Text style={type.tiny}>
          You can change this any time. None of these is a promise to buy.
        </Text>
      </View>
      {me ? null : (
        <Text style={type.small}>
          Next you&apos;ll sign in, or create a free account in a minute. Your answers are kept.
        </Text>
      )}
      <ErrorText>{err}</ErrorText>
    </Screen>
  );
}

const s = StyleSheet.create({
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -space.sm },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
});
