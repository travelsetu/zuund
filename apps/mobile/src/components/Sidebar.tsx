import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';
import { useMe } from '@/lib/auth';
import { colors, fonts, radius, space, type } from '@/theme';
import { Logo } from './Logo';
import { Avatar, Button, type IconName } from './ui';

const LINKS: Array<{
  href: string;
  label: string;
  icon: IconName;
  active: IconName;
  match: (p: string) => boolean;
}> = [
  { href: '/', label: 'Home', icon: 'home-outline', active: 'home', match: (p) => p === '/' },
  {
    href: '/collectives',
    label: 'Collectives',
    icon: 'people-outline',
    active: 'people',
    match: (p) => p.startsWith('/collectives'),
  },
  {
    href: '/messages',
    label: 'Messages',
    icon: 'chatbubbles-outline',
    active: 'chatbubbles',
    match: (p) => p.startsWith('/messages'),
  },
  {
    href: '/my-posts',
    label: 'My Buying Posts',
    icon: 'document-text-outline',
    active: 'document-text',
    match: (p) => p.startsWith('/my-posts') || p.startsWith('/posts'),
  },
  {
    href: '/connections',
    label: 'Connections',
    icon: 'person-add-outline',
    active: 'person-add',
    match: (p) => p.startsWith('/connections'),
  },
  {
    href: '/notifications',
    label: 'Notifications',
    icon: 'notifications-outline',
    active: 'notifications',
    match: (p) => p.startsWith('/notifications'),
  },
];

/**
 * Desktop web navigation: a calm personal sidebar (not an admin rail) — wordmark,
 * a handful of destinations, the one primary action, and "you" at the bottom.
 */
export function Sidebar() {
  const me = useMe();
  const path = usePathname();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    api.notifications
      .unreadCount()
      .then((r) => setUnread(r.count))
      .catch(() => {});
  }, [path]);

  return (
    <View style={s.bar}>
      <Pressable
        onPress={() => router.navigate('/')}
        accessibilityRole="link"
        accessibilityLabel="ZUUND home"
      >
        <Logo size={28} />
      </Pressable>
      <Button title="New Buying Post" icon="add" onPress={() => router.push('/search')} />
      <View style={{ gap: 2 }}>
        {LINKS.map((l) => {
          const on = l.match(path);
          return (
            <Pressable
              key={l.href}
              onPress={() => router.navigate(l.href as never)}
              style={({ hovered }) => [s.link, on && s.linkOn, hovered && !on && s.linkHover]}
              accessibilityRole="link"
              accessibilityState={{ selected: on }}
            >
              <Ionicons
                name={on ? l.active : l.icon}
                size={20}
                color={on ? colors.brand : colors.muted}
              />
              <Text style={[s.linkText, on && { color: colors.brand, fontFamily: fonts.semibold }]}>
                {l.label}
              </Text>
              {l.href === '/notifications' && unread > 0 ? (
                <View style={s.count}>
                  <Text style={{ color: colors.white, fontSize: 11, fontFamily: fonts.bold }}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => router.navigate('/profile')}
        style={({ hovered }) => [s.me, hovered && s.linkHover]}
        accessibilityRole="link"
        accessibilityLabel="Your profile"
      >
        <Avatar user={me} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={type.strong} numberOfLines={1}>
            {me.name}
          </Text>
          <Text style={type.small} numberOfLines={1}>
            {me.city?.name ?? 'Set your city'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={8}
          accessibilityLabel="Settings"
        >
          <Ionicons name="settings-outline" size={20} color={colors.muted} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    width: 272,
    backgroundColor: colors.white,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.line,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
    gap: space.xl,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  linkOn: { backgroundColor: colors.brandSoft },
  linkHover: { backgroundColor: colors.canvas },
  linkText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text, flex: 1 },
  count: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  me: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
  },
});
