import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useIsDesktop } from '@/lib/layout';
import { colors, fonts, radius, space } from '@/theme';
import { Logo } from './Logo';
import { Screen } from './ui';

// Friends at sunset (Pexels photo 939328, free to use under the Pexels licence).
const PHOTO = require('../../assets/images/auth-together.jpg');

/**
 * Sign-in and sign-up frame. Phones get the usual screen; desktop browsers get a
 * centred card: the photo with the ZUUND line on the left, the form on the right.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  const desktop = useIsDesktop();
  if (!desktop) return <Screen>{children}</Screen>;
  return (
    <View style={s.page}>
      <View style={s.card}>
        <View style={s.photo}>
          <Image
            source={PHOTO}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
          />
          {/* Darkens top and bottom so the logo and the line stay readable. */}
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            viewBox="0 0 1 1"
          >
            <Defs>
              <LinearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#050B1F" stopOpacity={0.55} />
                <Stop offset="0.35" stopColor="#050B1F" stopOpacity={0} />
                <Stop offset="0.6" stopColor="#050B1F" stopOpacity={0.1} />
                <Stop offset="1" stopColor="#050B1F" stopOpacity={0.85} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="1" height="1" fill="url(#shade)" />
          </Svg>
          <View style={s.photoInner}>
            <Logo size={30} light />
            <View style={{ gap: space.sm }}>
              <Text style={s.line}>People. Purchases.{'\n'}Better Together.</Text>
              <Text style={s.sub}>
                Find people in your city buying what you are buying, compare notes and decide
                together. Each of you buys for yourself.
              </Text>
            </View>
          </View>
        </View>
        <ScrollView
          style={s.formSide}
          contentContainerStyle={s.formInner}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.form}>{children}</View>
        </ScrollView>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 1120,
    height: '100%',
    maxHeight: 760,
    minHeight: 560,
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: '#0A1E4F',
    shadowOpacity: 0.1,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 16 },
  },
  photo: { width: '42%', backgroundColor: colors.navy },
  photoInner: {
    flex: 1,
    justifyContent: 'space-between',
    padding: space.xxl,
  },
  line: {
    fontFamily: fonts.heavy,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: colors.white,
  },
  sub: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: 'rgba(255,255,255,0.82)' },
  formSide: { flex: 1 },
  formInner: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
  },
  form: { width: '100%', maxWidth: 400, gap: space.lg },
});
