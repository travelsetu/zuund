import type { BuyerDto, CarDto } from '@zuund/shared';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { api, ApiRequestError } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useFocusData } from '@/lib/useAsync';
import { space, type } from '@/theme';
import { BuyerRow } from './BuyerRow';
import { ConnectButton } from './ConnectButton';
import { MemberPlans } from './MemberPlans';
import { BuyerPulse, UpgradeCard } from './Plan';
import { Button, Card, Loading } from './ui';

/**
 * Room insights for a car+city: the Live Buyer Pulse (everyone; Elite adds who's active,
 * who's new and nearby bands), your best matches with their score and reasons (Elite)
 * and how the collective's members plan (Elite). Used by the collective hub's Insights
 * screen and as the first tab of a Buying Post's collective screen.
 */
export function InsightsPanel({
  car,
  cityId,
  buyingIntentId,
  joined,
}: {
  car: Pick<CarDto, 'id' | 'category'>;
  cityId: string;
  /** Your post here: where "Upgrade" and "See all buyers" go. */
  buyingIntentId?: string | null;
  /** Best matches need an active membership; before joining they're left out. */
  joined: boolean;
}) {
  const me = useMe();
  const holiday = car.category === 'HOLIDAY';
  const { data, setData, error } = useFocusData(async () => {
    const scope = { carId: car.id, cityId };
    const [counts, matches] = await Promise.all([
      api.buyers.count(scope),
      joined
        ? // Elite only: anyone else gets the locked card below.
          api.buyers.matches({ ...scope, limit: 5 }).catch((e) => {
            if (e instanceof ApiRequestError && e.code === 'ELITE_REQUIRED') return null;
            throw e;
          })
        : Promise.resolve(null),
    ]);
    return { counts, matches };
  }, [car.id, cityId, joined]);

  if (!data) return error ? <Text style={type.small}>{error}</Text> : <Loading />;

  return (
    <>
      <BuyerPulse pulse={data.counts.pulse} buyingIntentId={buyingIntentId} />

      {data.matches ? (
        <Card style={{ gap: space.sm }}>
          <Text style={type.h3}>Your best matches</Text>
          <Text style={type.small}>
            How well each buyer lines up with your post: timeline, how sure they are and distance
            {holiday ? ', plus the trip' : ''}.
          </Text>
          {data.matches.length === 0 ? (
            <Text style={type.body}>No other buyers yet.</Text>
          ) : (
            data.matches.map((b: BuyerDto) => (
              <BuyerRow
                key={b.buyingIntentId}
                user={b.user}
                purchaseTimeline={b.purchaseTimeline}
                intentLevel={b.intentLevel}
                trip={b.holiday}
                activeRecently={b.activeRecently}
                withinKm={b.withinKm}
                match={b.match}
                action={
                  <ConnectButton
                    userId={b.user.id}
                    meId={me.id}
                    connection={b.connection}
                    onChange={(conn) =>
                      setData({
                        ...data,
                        matches: data.matches!.map((x) =>
                          x.user.id === b.user.id ? { ...x, connection: conn } : x,
                        ),
                      })
                    }
                  />
                }
              />
            ))
          )}
          {buyingIntentId && data.matches.length ? (
            <Button
              variant="ghost"
              title="See all buyers"
              onPress={() => router.push(`/posts/${buyingIntentId}/buyers`)}
            />
          ) : null}
        </Card>
      ) : joined ? (
        <UpgradeCard
          title="Your best matches"
          body="See which buyers line up best with your post, with a match score and the reasons: timeline, how sure they are and distance."
          buyingIntentId={buyingIntentId}
        />
      ) : null}

      <MemberPlans plans={data.counts.members} holiday={holiday} buyingIntentId={buyingIntentId} />
    </>
  );
}
