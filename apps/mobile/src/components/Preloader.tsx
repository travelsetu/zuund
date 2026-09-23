import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { space, type } from '@/theme';

/**
 * ZUUND's loading indicator: the two figures from the logo take turns to bob,
 * like two buyers nodding along. Holds still when the system asks for reduced
 * motion. `label` is optional ("Loading buyers…").
 */
export function Preloader({
  label,
  size = 44,
  fill,
}: {
  label?: string;
  size?: number;
  /** Take the whole screen (app start, full-page loads). */
  fill?: boolean;
}) {
  return (
    <View
      style={[s.wrap, fill && { flex: 1 }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <View style={{ flexDirection: 'row', gap: size * 0.12, alignItems: 'flex-end' }}>
        <Figure color="blue" size={size} delay={0} />
        <Figure color="green" size={size} delay={220} />
      </View>
      {label ? <Text style={[type.small, { marginTop: space.md }]}>{label}</Text> : null}
    </View>
  );
}

function Figure({ color, size, delay }: { color: 'blue' | 'green'; size: number; delay: number }) {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    const up = withTiming(-size * 0.22, { duration: 320, easing: Easing.out(Easing.quad) });
    const down = withTiming(0, { duration: 320, easing: Easing.in(Easing.quad) });
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(up, down, withTiming(0, { duration: 260 })),
        -1,
        false,
        undefined,
        ReduceMotion.System,
      ),
    );
  }, [reduce, size, delay, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const [top, bottom, head] =
    color === 'blue' ? ['#48A8F7', '#2D5EE6', '#3F8CF1'] : ['#6CCD60', '#3BA048', '#5DBE59'];
  const id = `pre-${color}`;
  const w = size * 0.62;
  return (
    <Animated.View style={style}>
      {/* One figure from brand/zuund-mark.svg: a U-shaped body and a head. */}
      <Svg width={w} height={size} viewBox="300 100 170 258">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
        </Defs>
        <Path
          d="M331 201V271A54 54 0 0 0 439 271V201"
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={62}
          strokeLinecap="round"
        />
        <Circle cx={385} cy={139} r={36} fill={head} />
      </Svg>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'transparent',
  },
});
