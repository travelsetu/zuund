import { Ionicons } from '@expo/vector-icons';
import { PRODUCT_CATEGORY_LABELS, type ProductCategory } from '@zuund/shared';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { VehicleArt } from '@/components/VehicleArt';
import { PostCard } from '@/components/PostCard';
import {
  Card,
  Hero,
  IconButton,
  Loading,
  ProductArt,
  Screen,
  SearchBox,
  Section,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { useIsDesktop } from '@/lib/layout';
import { useLightStatusBar } from '@/lib/statusBar';
import { useFocusData } from '@/lib/useAsync';
import { colors, radius, space, type, fonts } from '@/theme';

const CATEGORIES: Array<{ key: ProductCategory; hint: string }> = [
  { key: 'CAR', hint: 'New cars' },
  { key: 'SOLAR', hint: 'Rooftop systems' },
  { key: 'HOLIDAY', hint: 'Domestic & international' },
];

/** Mockup 2 — Home: search, the live categories, and the user's own activity. */
export default function Home() {
  const me = useMe();
  const desktop = useIsDesktop();
  useLightStatusBar();
  const { data, refresh, refreshing } = useFocusData(async () => {
    const [profile, intents, unread] = await Promise.all([
      api.users.profile(me.id),
      api.intents.list(),
      api.notifications.unreadCount(),
    ]);
    return { profile, intents: intents.items, unread: unread.count };
  });
  const active = data?.intents.filter((i) => i.status === 'ACTIVE' || i.status === 'PAUSED') ?? [];

  return (
    <Screen onRefresh={refresh} refreshing={refreshing} edges={[]}>
      <Hero>
        {/* On desktop the sidebar already carries the wordmark, city and notifications. */}
        {desktop ? null : (
          <View style={s.top}>
            <Logo size={26} light />
            <Pressable
              style={s.city}
              onPress={() => router.push('/edit-profile')}
              accessibilityLabel="Change city"
            >
              <Ionicons name="location" size={14} color={colors.onNavyMuted} />
              <Text style={{ color: colors.white, fontFamily: fonts.medium, fontSize: 14 }}>
                {me.city?.name ?? 'Set city'}
              </Text>
              <Ionicons name="chevron-down" size={13} color={colors.onNavyMuted} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <IconButton
              name="notifications-outline"
              label="Notifications"
              color={colors.white}
              badge={data?.unread}
              onPress={() => router.push('/notifications')}
            />
          </View>
        )}
        <View style={desktop ? s.heroRow : undefined}>
          <View style={{ gap: space.sm, marginTop: space.sm, flex: desktop ? 1 : undefined }}>
            <Text style={[type.display, { color: colors.white }]}>
              What are you{'\n'}looking to buy?
            </Text>
            <Text style={[type.body, { color: colors.onNavyMuted }]}>
              Same car. More buyers. Decide together.
            </Text>
          </View>
          <View
            style={s.carStage}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <VehicleArt segment="SUV" hero width={250} />
          </View>
        </View>
        <SearchBox placeholder="Search e.g. Hyundai Creta" onPress={() => router.push('/search')} />
      </Hero>

      <View style={s.grid}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c.key}
            style={({ pressed }) => [s.tile, pressed && { transform: [{ scale: 0.98 }] }]}
            onPress={() => router.push({ pathname: '/search', params: { category: c.key } })}
            accessibilityRole="button"
          >
            <ProductArt car={{ category: c.key, imageUrl: null }} size="sm" />
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>{PRODUCT_CATEGORY_LABELS[c.key]}</Text>
              <Text style={type.tiny}>{c.hint}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {!data ? <Loading /> : null}
      {data ? (
        <Section title="Your activity">
          <Card style={s.stats}>
            <Stat
              n={active.length}
              label={active.length === 1 ? 'Buying Post' : 'Buying Posts'}
              onPress={() => router.push('/my-posts')}
            />
            <View style={s.divider} />
            <Stat
              n={data?.profile.connectionCount}
              label="Connections"
              onPress={() => router.push('/connections')}
            />
            <View style={s.divider} />
            <Stat
              n={data?.profile.collectiveCount}
              label="Collectives"
              onPress={() => router.push('/collectives')}
            />
          </Card>
        </Section>
      ) : null}

      {active.length > 0 && (
        <Section title="Your Buying Posts">
          {active.slice(0, 3).map((i) => (
            <PostCard key={i.id} intent={i} />
          ))}
        </Section>
      )}
    </Screen>
  );
}

function Stat({
  n,
  label,
  onPress,
}: {
  n: number | undefined;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={{ flex: 1, alignItems: 'center', gap: 2 }}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Text style={[type.hero, { fontSize: 26, lineHeight: 30 }]}>{n ?? '–'}</Text>
      <Text style={type.small}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  carStage: { alignItems: 'flex-end', marginTop: -space.md, marginBottom: -space.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  // Two tiles a row on phones; the third takes a row of its own.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  tile: {
    flexGrow: 1,
    flexBasis: '40%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: space.md,
  },
  stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: space.lg },
  divider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: colors.line },
});
