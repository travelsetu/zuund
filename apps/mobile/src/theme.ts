/**
 * ZUUND design tokens. Brand stays royal blue + green; premium comes from a
 * deep "showroom" navy used for one hero surface per screen, a quieter
 * porcelain canvas, hairline structure and a single grotesque typeface.
 */
export const colors = {
  navy: '#0A1E4F',
  navySoft: '#1B3170',
  brand: '#1650E0',
  brandDark: '#0E3A9E',
  brandSoft: '#EAF0FD',
  green: '#0E9F5B',
  greenDark: '#0B8049',
  greenSoft: '#E4F5EC',
  orange: '#D9720A',
  orangeSoft: '#FDF1E4',
  purple: '#6D4AFF',
  purpleSoft: '#F0ECFF',
  red: '#D92D20',
  redSoft: '#FDEDEC',
  ink: '#0B1533',
  text: '#26314B',
  muted: '#5B6780',
  faint: '#98A1B5',
  line: '#E2E7F0',
  canvas: '#F4F6FA',
  card: '#FFFFFF',
  white: '#FFFFFF',
  onNavyMuted: '#AFC0E8',
} as const;

/** Radius follows hierarchy: surfaces 20, controls 12, chips/pills round. */
export const radius = { sm: 10, md: 12, lg: 20, xl: 24, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Schibsted Grotesk, loaded in the root layout. React Native needs one family name per weight. */
export const fonts = {
  regular: 'SchibstedGrotesk_400Regular',
  medium: 'SchibstedGrotesk_500Medium',
  semibold: 'SchibstedGrotesk_600SemiBold',
  bold: 'SchibstedGrotesk_700Bold',
  heavy: 'SchibstedGrotesk_800ExtraBold',
  black: 'SchibstedGrotesk_900Black',
} as const;

export const type = {
  display: {
    fontFamily: fonts.heavy,
    fontSize: 34,
    lineHeight: 38,
    color: colors.ink,
    letterSpacing: -0.8,
  },
  hero: {
    fontFamily: fonts.heavy,
    fontSize: 30,
    lineHeight: 34,
    color: colors.ink,
    letterSpacing: -0.6,
  },
  h1: {
    fontFamily: fonts.bold,
    fontSize: 24,
    lineHeight: 29,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: fonts.bold,
    fontSize: 19,
    lineHeight: 24,
    color: colors.ink,
    letterSpacing: -0.2,
  },
  h3: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 21, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, color: colors.text },
  strong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: colors.muted },
  tiny: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.muted },
} as const;

/** One soft, tight shadow; hairlines do most of the structural work. */
export const shadow = {
  shadowColor: '#0A1E4F',
  shadowOpacity: 0.06,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
} as const;

/** Intent level chip colours: Ready green, Committed blue, Interested amber. */
export const intentTone = {
  READY: { fg: colors.green, bg: colors.greenSoft },
  COMMITTED: { fg: colors.brand, bg: colors.brandSoft },
  INTERESTED: { fg: colors.orange, bg: colors.orangeSoft },
} as const;
