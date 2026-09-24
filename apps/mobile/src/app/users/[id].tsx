import { Ionicons } from '@expo/vector-icons';
import { INTENT_LEVEL_LABELS, PURCHASE_TIMELINE_LABELS } from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { ConnectButton } from '@/components/ConnectButton';
import { EliteBadge, UpgradeCard } from '@/components/Plan';
import {
  Avatar,
  Card,
  Header,
  IconButton,
  IntentBadge,
  Loading,
  ProductArt,
  Screen,
  Verified,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { listTime } from '@/lib/format';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type, fonts } from '@/theme';

/** Spec §18/§69 — another buyer's profile. No phone, email or address, ever. */
export default function BuyerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { data, setData, error, refresh, refreshing } = useFocusData(
    () => api.users.profile(id),
    [id],
  );

  if (!data)
    return (
      <Screen onRefresh={refresh} refreshing={refreshing}>
        <Header />
        {error ? <Text style={type.small}>{error}</Text> : <Loading />}
      </Screen>
    );
  const { user } = data;
  const self = user.id === me.id;

  function more() {
    Alert.alert(user.name ?? 'Buyer', undefined, [
      {
        text: 'Report',
        onPress: () =>
          api.reports
            .create({ targetType: 'USER', targetId: user.id, reason: 'Inappropriate behaviour' })
            .then(() => Alert.alert('Reported', 'Thanks — our team will review it.'))
            .catch((e) => Alert.alert('Could not report', errorMessage(e))),
      },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            `Block ${user.name}?`,
            'They will not be able to connect with or message you.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: () =>
                  api.connections
                    .block(user.id)
                    .then(() => router.back())
                    .catch((e) => Alert.alert('Could not block', errorMessage(e))),
              },
            ],
          ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header
        right={
          self ? undefined : <IconButton name="ellipsis-horizontal" label="More" onPress={more} />
        }
      />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar user={user} size={96} />
        <Text style={type.h1}>{user.name}</Text>
        {user.verificationStatus === 'VERIFIED' ? <Verified /> : null}
        {user.elite ? <EliteBadge /> : null}
        {user.city ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location" size={15} color={colors.brand} />
            <Text style={type.body}>{user.city.name}</Text>
          </View>
        ) : null}
        <Text style={type.small}>
          {data.connectionCount} {data.connectionCount === 1 ? 'connection' : 'connections'},{' '}
          {data.collectiveCount} {data.collectiveCount === 1 ? 'collective' : 'collectives'}
        </Text>
        {data.lastActiveAt ? (
          <Text style={type.tiny}>Last active {listTime(data.lastActiveAt)}</Text>
        ) : null}
      </View>

      {!self ? (
        <View style={{ alignSelf: 'center', minWidth: 180 }}>
          <ConnectButton
            small={false}
            userId={user.id}
            meId={me.id}
            connection={data.connection}
            onChange={(c) => setData({ ...data, connection: c })}
          />
        </View>
      ) : null}

      {data.activeIntents.map((i) => (
        <Card key={i.id} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <ProductArt car={i.car} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={type.small}>Looking for</Text>
              <Text style={type.h3}>{i.car.displayName}</Text>
            </View>
            {i.intentLevel ? <IntentBadge level={i.intentLevel} /> : null}
          </View>
          {i.purchaseTimeline && i.intentLevel ? (
            <Text style={type.body}>
              Buying:{' '}
              <Text style={{ fontFamily: fonts.bold }}>
                {PURCHASE_TIMELINE_LABELS[i.purchaseTimeline]}
              </Text>{' '}
              in {i.city.name}. Intent:{' '}
              <Text style={{ fontFamily: fonts.bold }}>{INTENT_LEVEL_LABELS[i.intentLevel]}</Text>
            </Text>
          ) : (
            <Text style={type.small}>In {i.city.name}</Text>
          )}
        </Card>
      ))}
      {data.detailsLocked && data.activeIntents.length ? (
        <UpgradeCard
          title="See full details"
          body="Elite shows when this buyer plans to buy, how sure they are and when they were last active."
          buyingIntentId={me.pass?.buyingIntentId}
        />
      ) : null}

      {user.about ? (
        <Card style={{ gap: 6 }}>
          <Text style={type.h3}>About</Text>
          <Text style={type.body}>{user.about}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}
