import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * The ZUUND wordmark (brand/zuund-logo.svg): navy Z·N·D, and two U's drawn as
 * people — a blue and a green buyer, together. `size` is roughly the letter
 * height, so it lines up with the text sizes used before. `light` = white
 * letters for the navy hero.
 */
export function Logo({ size = 28, light }: { size?: number; light?: boolean }) {
  const id = useId().replace(/:/g, '');
  const height = size * 1.5;
  const width = (height * 1010) / 268;
  const ink = light ? '#FFFFFF' : '#071833';
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="ZUUND">
      <Svg width={width} height={height} viewBox="0 0 1010 268">
        <Defs>
          <LinearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#48A8F7" />
            <Stop offset="1" stopColor="#2D5EE6" />
          </LinearGradient>
          <LinearGradient id={`${id}g`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#6CCD60" />
            <Stop offset="1" stopColor="#3BA048" />
          </LinearGradient>
        </Defs>
        <G transform="translate(-80 -95)">
          <G fill={ink} stroke={ink} strokeWidth={10} strokeLinejoin="round">
            <Path d="M92 174H286V228L162 302H286V352H92V298L216 224H92Z" />
            <Path d="M694 174H750L818 272V174H876V352H820L752 254V352H694Z" />
            <Path
              fillRule="evenodd"
              d="M899 174H988A89 89 0 0 1 988 352H899ZM957 226V300H982A37 37 0 0 0 982 226Z"
            />
          </G>
          <Path
            d="M331 201V271A54 54 0 0 0 439 271V201"
            fill="none"
            stroke={`url(#${id}b)`}
            strokeWidth={62}
            strokeLinecap="round"
          />
          <Circle cx={385} cy={139} r={36} fill="#3F8CF1" />
          <Path
            d="M536 201V271A54 54 0 0 0 644 271V201"
            fill="none"
            stroke={`url(#${id}g)`}
            strokeWidth={62}
            strokeLinecap="round"
          />
          <Circle cx={590} cy={139} r={36} fill="#5DBE59" />
        </G>
      </Svg>
    </View>
  );
}
