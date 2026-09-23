import type { ProductCategory } from '@zuund/shared';
import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, radius, space, type } from '@/theme';
import { SearchBox } from './ui';
import { VehicleArt } from './VehicleArt';

type Slide = { category: ProductCategory; tagline: string; search: string };

/** Copy follows the spec: people deciding together, no discount or savings promises. */
const SLIDES: Slide[] = [
  {
    category: 'CAR',
    tagline: 'Same car. More buyers. Decide together.',
    search: 'Search e.g. Hyundai Creta',
  },
  {
    category: 'SOLAR',
    tagline: 'Same rooftop system. Neighbours compare notes.',
    search: 'Search e.g. 3 kW rooftop solar',
  },
  {
    category: 'HOLIDAY',
    tagline: 'Same trip. Plan it with people from your city.',
    search: 'Search holidays, e.g. Goa or Dubai',
  },
];

const ART_W = 250;
const ART_H = 120;
const AUTOPLAY_MS = 5000;

/**
 * The home banner's tagline, drawing and search box, one slide per category.
 * Swipe or tap a dot; it moves on by itself until the first touch, and never
 * when the system asks for reduced motion.
 */
export function HeroSlider({
  desktop,
  onSearch,
}: {
  desktop: boolean;
  onSearch: (category: ProductCategory) => void;
}) {
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [touched, setTouched] = useState(false);
  const reduceMotion = useReducedMotion();
  const slide = SLIDES[index]!;

  const goTo = (i: number, animated = true) => {
    scroller.current?.scrollTo({ x: i * width, animated });
    setIndex(i);
  };

  useEffect(() => {
    if (touched || reduceMotion || !width) return;
    const t = setTimeout(() => {
      const next = (index + 1) % SLIDES.length;
      scroller.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [index, touched, reduceMotion, width]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i);
  };

  return (
    <View style={{ gap: space.md }}>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={32}
            onScrollBeginDrag={() => setTouched(true)}
          >
            {SLIDES.map((sl) => (
              <View
                key={sl.category}
                style={[{ width }, desktop ? s.slideRow : s.slide]}
                accessible
                accessibilityLabel={sl.tagline}
              >
                <Text
                  style={[
                    type.body,
                    { color: colors.onNavyMuted },
                    desktop && { flex: 1, alignSelf: 'flex-start' },
                  ]}
                >
                  {sl.tagline}
                </Text>
                <View
                  style={s.stage}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  {sl.category === 'CAR' ? (
                    <VehicleArt segment="SUV" hero width={ART_W} />
                  ) : sl.category === 'SOLAR' ? (
                    <SolarArt />
                  ) : (
                    <HolidayArt />
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
        ) : (
          <View style={{ height: ART_H + 40 }} />
        )}
      </View>
      <View style={s.dots}>
        {SLIDES.map((sl, i) => (
          <Pressable
            key={sl.category}
            hitSlop={8}
            onPress={() => {
              setTouched(true);
              goTo(i);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Show slide ${i + 1} of ${SLIDES.length}`}
            accessibilityState={{ selected: i === index }}
          >
            <View style={[s.dot, i === index && s.dotOn]} />
          </Pressable>
        ))}
      </View>
      <SearchBox placeholder={slide.search} onPress={() => onSearch(slide.category)} />
    </View>
  );
}

/** A rooftop panel in perspective under the sun, drawn to sit beside the banner car. */
function SolarArt() {
  // Panel corners: a narrower top edge reads as tilted towards the sky.
  const top = { l: 58, r: 168, y: 34 };
  const bot = { l: 30, r: 196, y: 90 };
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const cols = [0.25, 0.5, 0.75];
  const rows = [1 / 3, 2 / 3];
  return (
    <Svg width={ART_W} height={ART_H} viewBox={`0 0 ${ART_W} ${ART_H}`}>
      <Defs>
        <LinearGradient id="panel" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#4F8BF9" />
          <Stop offset="1" stopColor="#1D4ED8" />
        </LinearGradient>
      </Defs>
      <G>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <Line
              key={i}
              x1={214 + Math.cos(a) * 20}
              y1={26 + Math.sin(a) * 20}
              x2={214 + Math.cos(a) * 27}
              y2={26 + Math.sin(a) * 27}
              stroke="#FDB022"
              strokeWidth={3}
              strokeLinecap="round"
            />
          );
        })}
        <Circle cx={214} cy={26} r={14} fill="#FDB022" />
      </G>
      <Ellipse cx={113} cy={113} rx={92} ry={4} fill="#000" opacity={0.25} />
      <Path d="M108 90 L118 90 L120 111 L106 111 Z" fill="#94A3B8" />
      <Path
        d={`M${top.l} ${top.y} L${top.r} ${top.y} L${bot.r} ${bot.y} L${bot.l} ${bot.y} Z`}
        fill="url(#panel)"
        stroke="#DCE7FF"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      {cols.map((t) => (
        <Line
          key={`c${t}`}
          x1={lerp(top.l, top.r, t)}
          y1={top.y}
          x2={lerp(bot.l, bot.r, t)}
          y2={bot.y}
          stroke="#DCE7FF"
          strokeOpacity={0.55}
          strokeWidth={1.5}
        />
      ))}
      {rows.map((t) => (
        <Line
          key={`r${t}`}
          x1={lerp(top.l, bot.l, t)}
          y1={lerp(top.y, bot.y, t)}
          x2={lerp(top.r, bot.r, t)}
          y2={lerp(top.y, bot.y, t)}
          stroke="#DCE7FF"
          strokeOpacity={0.55}
          strokeWidth={1.5}
        />
      ))}
      {/* A glint on the glass. */}
      <Path d="M70 42 L96 42 L84 60 L58 60 Z" fill="#fff" opacity={0.18} />
    </Svg>
  );
}

/** A plane climbing away along a dotted route, with a couple of clouds. */
function HolidayArt() {
  return (
    <Svg width={ART_W} height={ART_H} viewBox={`0 0 ${ART_W} ${ART_H}`}>
      <Path
        d="M26 104 C70 96 96 52 140 58 C170 62 178 40 196 30"
        fill="none"
        stroke={colors.onNavyMuted}
        strokeOpacity={0.7}
        strokeWidth={2.5}
        strokeDasharray="2 8"
        strokeLinecap="round"
      />
      <Circle cx={26} cy={104} r={5} fill="#FDB022" />
      <G opacity={0.16} fill="#fff">
        <Circle cx={48} cy={40} r={12} />
        <Circle cx={64} cy={34} r={15} />
        <Circle cx={80} cy={42} r={10} />
        <Path d="M36 46 H88 A6 6 0 0 1 88 52 H36 A6 6 0 0 1 36 46 Z" />
        <Circle cx={150} cy={96} r={9} />
        <Circle cx={163} cy={91} r={12} />
        <Circle cx={176} cy={98} r={8} />
      </G>
      {/* Material "flight" glyph (points up), turned towards the end of the route. */}
      <G transform="translate(214 24) rotate(58) scale(2.6) translate(-12 -12)">
        <Path
          d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"
          fill="#fff"
        />
      </G>
    </Svg>
  );
}

const s = StyleSheet.create({
  slide: { gap: space.sm },
  slideRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg },
  stage: { alignItems: 'flex-end', height: ART_H, justifyContent: 'flex-end' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  dot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dotOn: { width: 22, backgroundColor: colors.white },
});
