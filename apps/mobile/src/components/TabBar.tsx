import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsDesktop } from '@/lib/layout';
import { colors, shadow, fonts } from '@/theme';
import type { IconName } from './ui';

const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  index: { label: 'Home', icon: 'home-outline', active: 'home' },
  collectives: { label: 'Collective', icon: 'people-outline', active: 'people' },
  messages: { label: 'Messages', icon: 'chatbubbles-outline', active: 'chatbubbles' },
  profile: { label: 'Profile', icon: 'person-outline', active: 'person' },
};

/** Bottom bar from the mockups: four tabs with a raised "+" (new Buying Post) in the middle. */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const desktop = useIsDesktop();
  if (desktop) return null; // the sidebar takes over
  const routes = state.routes.filter((r) => TABS[r.name]);
  // Guests only have Home; sign-in sits where Profile would be.
  const guest = routes.length === 1;
  const left = routes.slice(0, 2);
  const right = routes.slice(2);
  const tab = (route: (typeof routes)[number]) => {
    const meta = TABS[route.name]!;
    const focused = state.routes[state.index]?.key === route.key;
    return (
      <Pressable
        key={route.key}
        style={s.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => {
          const e = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <Ionicons
          name={focused ? meta.active : meta.icon}
          size={23}
          color={focused ? colors.brand : colors.muted}
        />
        <Text style={[s.label, { color: focused ? colors.brand : colors.muted }]}>
          {meta.label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {left.map(tab)}
      <View style={s.tab}>
        <Pressable
          style={s.plus}
          onPress={() => router.push('/search')}
          accessibilityRole="button"
          accessibilityLabel="Create a Buying Post"
        >
          <Ionicons name="add" size={30} color={colors.white} />
        </Pressable>
      </View>
      {guest ? (
        <Pressable style={s.tab} accessibilityRole="button" onPress={() => router.push('/login')}>
          <Ionicons name="log-in-outline" size={23} color={colors.muted} />
          <Text style={[s.label, { color: colors.muted }]}>Log in</Text>
        </Pressable>
      ) : (
        right.map(tab)
      )}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 11, fontFamily: fonts.semibold },
  plus: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    ...shadow,
    shadowOpacity: 0.25,
  },
});
