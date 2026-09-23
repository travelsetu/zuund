import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { VehicleArt } from '@/components/VehicleArt';
import { Button, Column, type IconName } from '@/components/ui';
import { colors, radius, space, type } from '@/theme';

type Slide = { title: string; body: string; art: 'car' | IconName };

/** Copy avoids deal/discount promises (spec §6, §92). */
const SLIDES: Slide[] = [
  {
    title: 'People. Purchases.\nBetter Together.',
    body: 'Find people who want to buy what you want to buy. Connect, compare notes and decide together — each of you buys individually.',
    art: 'car',
  },
  {
    title: 'Verified profiles',
    body: 'Verified badges show who has confirmed their details, so you know who you are talking to.',
    art: 'shield-checkmark',
  },
  {
    title: 'Real discussions',
    body: 'Share quotes, ask questions and compare notes with buyers in your city in one thread.',
    art: 'chatbubbles',
  },
  {
    title: 'Decide together',
    body: 'Run polls and settle on the next step as a group. Every purchase stays your own.',
    art: 'people',
  },
];

/** Mockup 1 — onboarding, as swipeable slides. */
export default function Welcome() {
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const last = index === SLIDES.length - 1;

  const goTo = (i: number) => {
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <Column max={480}>
        <View style={s.top}>
          <Logo size={40} />
          {!last && (
            <Pressable
              hitSlop={12}
              onPress={() => goTo(SLIDES.length - 1)}
              accessibilityRole="button"
            >
              <Text style={[type.strong, { color: colors.muted }]}>Skip</Text>
            </Pressable>
          )}
        </View>
        <View style={{ flex: 1 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 && (
            <ScrollView
              ref={scroller}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={onScroll}
              scrollEventThrottle={32}
              style={{ flex: 1 }}
            >
              {SLIDES.map((slide) => (
                <View key={slide.title} style={[s.slide, { width }]}>
                  <View style={s.art}>
                    {slide.art === 'car' ? (
                      <VehicleArt segment="SUV" hero width={Math.min(300, width - 48)} />
                    ) : (
                      <View style={s.badge}>
                        <Ionicons name={slide.art} size={64} color={colors.green} />
                      </View>
                    )}
                  </View>
                  <Text style={[type.h1, s.center]}>{slide.title}</Text>
                  <Text style={[type.body, s.center, { color: colors.muted, marginTop: space.md }]}>
                    {slide.body}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
        <View style={s.dots}>
          {SLIDES.map((slide, i) => (
            <Pressable
              key={slide.title}
              hitSlop={8}
              onPress={() => goTo(i)}
              accessibilityRole="button"
              accessibilityLabel={`Slide ${i + 1} of ${SLIDES.length}`}
              accessibilityState={{ selected: i === index }}
            >
              <View style={[s.dot, i === index && s.dotOn]} />
            </Pressable>
          ))}
        </View>
        <View style={{ padding: space.lg, gap: space.sm }}>
          {last ? (
            <Button title="Get Started" onPress={() => router.push('/register')} />
          ) : (
            <Button title="Next" onPress={() => goTo(index + 1)} />
          )}
          <Button
            variant="ghost"
            title="I already have an account"
            onPress={() => router.push('/login')}
          />
        </View>
      </Column>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    minHeight: 56,
  },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  art: { height: 190, justifyContent: 'center', marginBottom: space.xl },
  badge: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, paddingTop: space.md },
  dot: { width: 8, height: 8, borderRadius: radius.pill, backgroundColor: colors.line },
  dotOn: { width: 24, backgroundColor: colors.brand },
});
