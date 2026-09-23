import { Ionicons } from '@expo/vector-icons';
import type { CollectiveDto } from '@zuund/shared';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import {
  Button,
  Card,
  Empty,
  Header,
  Loading,
  ProductArt,
  Screen,
  StatusBadge,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type } from '@/theme';

/** Collectives the user has joined (paid) or started joining (payment pending). */
export default function Collectives() {
  const { data, refresh, refreshing, error } = useFocusData(() =>
    api.collectives.list({ mine: true }),
  );
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title="My Collectives" back={false} />
      {!data ? (
        error ? (
          <Text style={type.small}>{error}</Text>
        ) : (
          <Loading />
        )
      ) : data.items.length === 0 ? (
        <Empty
          icon="people-outline"
          title="No collectives yet"
          body="Create a Buying Post: it joins the collective for that item and your city."
          action={
            <Button small title="Create a Buying Post" onPress={() => router.push('/search')} />
          }
        />
      ) : (
        data.items.map((c) => <CollectiveCard key={c.id} c={c} />)
      )}
    </Screen>
  );
}

function CollectiveCard({ c }: { c: CollectiveDto }) {
  const active = c.membership?.status === 'ACTIVE';
  const open = () =>
    active
      ? router.push(`/collectives/${c.id}`)
      : c.membership && router.push(`/posts/${c.membership.buyingIntentId}/collective`);
  return (
    <Pressable onPress={open} accessibilityRole="button">
      <Card style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <ProductArt car={c.car} size="sm" />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={type.h3} numberOfLines={1}>
            {c.car.displayName} Buyers
          </Text>
          <Text style={type.small}>
            {c.city.name}, {c.activeMemberCount} {c.activeMemberCount === 1 ? 'member' : 'members'}
          </Text>
          {active ? (
            <StatusBadge label="Member" tone="green" />
          ) : (
            <StatusBadge label="Buying Pass needed" tone="orange" />
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.faint} />
      </Card>
    </Pressable>
  );
}
