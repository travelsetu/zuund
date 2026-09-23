import { Ionicons } from '@expo/vector-icons';
import { PURCHASE_TIMELINE_LABELS, INTENT_LEVEL_LABELS } from '@zuund/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Header,
  IconButton,
  ProductArt,
  Screen,
  Verified,
  type IconName,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useAuth, useMe } from '@/lib/auth';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type, fonts } from '@/theme';

/** Mockup 13 — My Profile: who I am and what I'm buying, as other buyers see it. */
export default function Profile() {
  const me = useMe();
  const { reload: reloadMe } = useAuth();
  const { data, refresh, refreshing } = useFocusData(async () => {
    await reloadMe().catch(() => {});
    return api.users.profile(me.id);
  });
  const primary = data?.activeIntents[0];

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header
        back={false}
        right={
          <IconButton
            name="settings-outline"
            label="Settings"
            onPress={() => router.push('/settings')}
          />
        }
      />
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Avatar user={me} size={104} />
        <Text style={type.h1}>{me.name}</Text>
        {me.verificationStatus === 'VERIFIED' ? (
          <Verified />
        ) : (
          <Text style={type.small}>Not verified yet</Text>
        )}
        {me.city ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="location" size={15} color={colors.brand} />
            <Text style={type.body}>{me.city.name}</Text>
          </View>
        ) : null}
      </View>

      {primary ? (
        <Card style={{ gap: space.md }}>
          <Pressable style={s.line} onPress={() => router.push(`/posts/${primary.id}`)}>
            <ProductArt car={primary.car} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={type.small}>Buying for</Text>
              <Text style={type.h3}>{primary.car.displayName}</Text>
            </View>
          </Pressable>
          <Fact
            icon="time-outline"
            label="Buying timeframe"
            value={PURCHASE_TIMELINE_LABELS[primary.purchaseTimeline]}
          />
          <Fact
            icon="person-outline"
            label="Intent"
            value={INTENT_LEVEL_LABELS[primary.intentLevel]}
          />
          {data && data.activeIntents.length > 1 ? (
            <Button
              small
              variant="ghost"
              title={`+${data.activeIntents.length - 1} more Buying Posts`}
              onPress={() => router.push('/my-posts')}
            />
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text style={type.body}>No active Buying Post.</Text>
          <Button
            small
            variant="ghost"
            title="Create a Buying Post"
            onPress={() => router.push('/search')}
          />
        </Card>
      )}

      <Card style={{ gap: 6 }}>
        <Text style={type.h3}>About</Text>
        <Text style={[type.body, !me.about && { color: colors.faint }]}>
          {me.about || 'Tell other buyers a little about what you are looking for.'}
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Card style={s.count}>
          <Text style={type.h2}>{data?.connectionCount ?? '–'}</Text>
          <Text style={type.small}>Connections</Text>
        </Card>
        <Card style={s.count}>
          <Text style={type.h2}>{data?.collectiveCount ?? '–'}</Text>
          <Text style={type.small}>Collectives</Text>
        </Card>
      </View>

      <Button variant="outline" title="Edit Profile" onPress={() => router.push('/edit-profile')} />
    </Screen>
  );
}

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={s.line}>
      <View style={s.factIcon}>
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>
      <View>
        <Text style={type.small}>{label}</Text>
        <Text style={[type.body, { fontFamily: fonts.semibold }]}>{value}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  factIcon: { width: 64, alignItems: 'center' },
  count: { flex: 1, alignItems: 'center', paddingVertical: space.md },
});
