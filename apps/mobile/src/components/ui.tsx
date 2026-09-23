import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  INTENT_LEVEL_LABELS,
  type CarDto,
  type IntentLevel,
  type PublicUserDto,
} from '@zuund/shared';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { initials } from '@/lib/format';
import { VehicleArt } from './VehicleArt';
import { CONTENT_MAX_WIDTH, useIsDesktop } from '@/lib/layout';
import { tokens } from '@/lib/tokens';
import { colors, intentTone, radius, shadow, space, type, fonts } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ── Layout ──

export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  onRefresh,
  refreshing = false,
  padded = true,
  footer,
  bg = colors.canvas,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  onRefresh?: () => void;
  refreshing?: boolean;
  padded?: boolean;
  footer?: ReactNode;
  bg?: string;
}) {
  const desktop = useIsDesktop();
  const pad = padded ? { paddingHorizontal: space.lg } : null;
  // Desktop web: a centred reading column rather than edge-to-edge.
  const column = desktop ? desktopColumn : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[pad, column, { paddingBottom: space.xxl, gap: space.lg }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.brand}
                colors={[colors.brand]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, pad, column]}>{children}</View>
      )}
      {footer ? (
        <View style={styles.footer}>
          <View style={[{ gap: space.sm }, column && { ...column, paddingTop: 0 }]}>{footer}</View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  right,
  back = true,
  align = 'center',
  light,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  back?: boolean;
  align?: 'center' | 'left';
  /** White text and back arrow, for use inside <Hero>. */
  light?: boolean;
}) {
  return (
    <View style={[styles.header, light && { paddingVertical: 0 }]}>
      <View style={styles.headerSide}>
        {back && (
          <Pressable
            hitSlop={12}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={26} color={light ? colors.white : colors.ink} />
          </Pressable>
        )}
      </View>
      <View style={{ flex: 1, alignItems: align === 'center' ? 'center' : 'flex-start' }}>
        {title ? (
          <Text
            style={[type.h3, { fontSize: 17 }, light && { color: colors.white }]}
            numberOfLines={1}
          >
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[type.small, light && { color: colors.onNavyMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  color = colors.ink,
  label,
  badge,
}: {
  name: IconName;
  onPress: () => void;
  color?: string;
  label: string;
  badge?: number;
}) {
  return (
    <Pressable hitSlop={10} onPress={onPress} accessibilityLabel={label} accessibilityRole="button">
      <Ionicons name={name} size={23} color={color} />
      {badge ? (
        <View style={styles.dot}>
          <Text style={{ color: colors.white, fontSize: 9, fontFamily: fonts.heavy }}>
            {badge > 9 ? '9+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Centres a full-height page in a reading column on desktop web; a plain flex:1 view elsewhere. */
export function Column({
  children,
  max = CONTENT_MAX_WIDTH,
}: {
  children: ReactNode;
  max?: number;
}) {
  const desktop = useIsDesktop();
  return (
    <View style={[{ flex: 1 }, desktop && { width: '100%', maxWidth: max, alignSelf: 'center' }]}>
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.md }}>
      <View style={styles.rowBetween}>
        <Text style={type.h3}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

// ── Controls ──

type ButtonVariant = 'primary' | 'green' | 'outline' | 'ghost' | 'danger' | 'light';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: v.bg, borderColor: v.border },
        pressed && { opacity: 0.9, transform: [{ scale: 0.985 }] },
        off && { opacity: 0.55 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 16 : 19} color={v.fg} /> : null}
          <Text style={[styles.buttonText, small && { fontSize: 13 }, { color: v.fg }]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.brand, fg: colors.white, border: colors.brand },
  green: { bg: colors.green, fg: colors.white, border: colors.green },
  outline: { bg: colors.white, fg: colors.brand, border: colors.brand },
  ghost: { bg: 'transparent', fg: colors.brand, border: 'transparent' },
  danger: { bg: colors.white, fg: colors.red, border: colors.red },
  /** On the navy hero. */
  light: { bg: colors.white, fg: colors.navy, border: colors.white },
};

export function Chip({
  label,
  active,
  onPress,
  tone,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: { fg: string; bg: string };
}) {
  const fg = active ? colors.white : (tone?.fg ?? colors.text);
  const bg = active ? (tone?.fg ?? colors.green) : (tone?.bg ?? colors.white);
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: bg, borderColor: active ? bg : colors.line }]}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
    >
      <Text style={{ color: fg, fontSize: 13, fontFamily: fonts.semibold }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}
    >
      {children}
    </ScrollView>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string | null }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        style={[
          styles.input,
          props.multiline && { minHeight: 96, textAlignVertical: 'top' },
          props.style,
        ]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function SearchBox({
  value,
  onChangeText,
  placeholder,
  autoFocus,
  onPress,
}: {
  value?: string;
  onChangeText?: (t: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** Renders as a tappable fake input (Home → Search). */
  onPress?: () => void;
}) {
  const inner = (
    <>
      <Ionicons name="search" size={19} color={colors.muted} />
      {onPress ? (
        <Text style={[type.body, { color: colors.faint, flex: 1 }]}>{placeholder}</Text>
      ) : (
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          autoFocus={autoFocus}
          autoCorrect={false}
          returnKeyType="search"
          style={[type.body, { flex: 1, paddingVertical: 0 }]}
        />
      )}
      {value && onChangeText ? (
        <Pressable hitSlop={10} onPress={() => onChangeText('')} accessibilityLabel="Clear">
          <Ionicons name="close-circle" size={19} color={colors.faint} />
        </Pressable>
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable style={styles.search} onPress={onPress} accessibilityRole="search">
      {inner}
    </Pressable>
  ) : (
    <View style={styles.search}>{inner}</View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        pressed && onPress && { backgroundColor: colors.canvas },
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {icon ? <Ionicons name={icon} size={21} color={danger ? colors.red : colors.brand} /> : null}
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontFamily: fonts.medium }, danger && { color: colors.red }]}>
          {title}
        </Text>
        {subtitle ? <Text style={type.small}>{subtitle}</Text> : null}
      </View>
      {right ??
        (onPress && !danger ? (
          <Ionicons name="chevron-forward" size={18} color={colors.faint} />
        ) : null)}
    </Pressable>
  );
}

// ── Identity ──

export function Avatar({
  user,
  size = 44,
}: {
  user: Pick<PublicUserDto, 'name' | 'photoUrl'>;
  size?: number;
}) {
  const round = { width: size, height: size, borderRadius: size / 2 };
  if (user.photoUrl) {
    // Photos are served by GET /api/files/:id, which needs the bearer token.
    return (
      <Image
        source={{
          uri: user.photoUrl,
          headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : undefined,
        }}
        style={[round, { backgroundColor: colors.brandSoft }]}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[round, styles.center, { backgroundColor: colors.brandSoft }]}>
      <Text style={{ color: colors.brand, fontFamily: fonts.bold, fontSize: size * 0.36 }}>
        {initials(user.name)}
      </Text>
    </View>
  );
}

export function Verified({ small }: { small?: boolean }) {
  return (
    <View style={[styles.verified, small && { paddingHorizontal: 6, paddingVertical: 1 }]}>
      <Ionicons name="checkmark-circle" size={small ? 12 : 14} color={colors.green} />
      <Text style={{ color: colors.green, fontSize: small ? 11 : 12, fontFamily: fonts.bold }}>
        Verified
      </Text>
    </View>
  );
}

export function IntentBadge({ level }: { level: IntentLevel }) {
  const t = intentTone[level];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.fg, fontSize: 12, fontFamily: fonts.semibold }}>
        {INTENT_LEVEL_LABELS[level]}
      </Text>
    </View>
  );
}

/** "PENDING_PAYMENT" → "Pending payment"; mixed-case labels pass through. */
export function sentenceCase(label: string): string {
  if (label !== label.toUpperCase()) return label;
  const s = label.replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'green' | 'blue' | 'orange' | 'red' | 'grey';
}) {
  const t = {
    green: { fg: colors.green, bg: colors.greenSoft },
    blue: { fg: colors.brand, bg: colors.brandSoft },
    orange: { fg: colors.orange, bg: colors.orangeSoft },
    red: { fg: colors.red, bg: colors.redSoft },
    grey: { fg: colors.muted, bg: colors.canvas },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.fg, fontSize: 12, fontFamily: fonts.semibold }}>
        {sentenceCase(label)}
      </Text>
    </View>
  );
}

/**
 * Catalog art. We don't hold licensed product photography, so unless the
 * catalog row has an image we draw a category illustration.
 */
export function ProductArt({
  car,
  size = 'md',
  onDark,
}: {
  car: Pick<CarDto, 'category' | 'imageUrl'> & { segment?: string | null };
  size?: 'sm' | 'md' | 'lg';
  /** Drawn on the navy hero: translucent plate, light vehicle. */
  onDark?: boolean;
}) {
  const dim = {
    sm: { w: 64, h: 48, i: 30 },
    md: { w: 124, h: 84, i: 56 },
    lg: { w: 260, h: 160, i: 116 },
  }[size];
  if (car.imageUrl) {
    return (
      <Image
        source={{ uri: car.imageUrl }}
        style={{ width: dim.w, height: dim.h }}
        contentFit="contain"
      />
    );
  }
  const solar = car.category === 'SOLAR';
  return (
    <View
      style={[
        styles.center,
        {
          width: dim.w,
          height: dim.h,
          borderRadius: size === 'sm' ? radius.md : radius.lg,
          backgroundColor: onDark
            ? 'rgba(255,255,255,0.07)'
            : solar
              ? colors.orangeSoft
              : colors.brandSoft,
          overflow: 'hidden',
        },
      ]}
    >
      {solar ? (
        <MaterialCommunityIcons
          name="solar-panel-large"
          size={dim.i}
          color={onDark ? colors.white : colors.orange}
        />
      ) : (
        // ZUUND's own drawing for the body type: no manufacturer photos or logos.
        <VehicleArt segment={car.segment} width={dim.w * 0.88} onDark={onDark} />
      )}
    </View>
  );
}

/**
 * The navy "showroom" band: one per key screen, holding its headline moment.
 * Runs under the status bar; pair with <Screen edges={[]}> and useLightStatusBar().
 */
export function Hero({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const desktop = useIsDesktop();
  return (
    <View
      style={[
        styles.hero,
        desktop
          ? { paddingTop: space.xl, paddingHorizontal: space.xl, borderRadius: 28 }
          : { paddingTop: insets.top + space.sm, marginHorizontal: -space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ── Feedback ──

export function Loading() {
  return (
    <View style={[styles.center, { paddingVertical: 48 }]}>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export function Empty({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={[styles.center, { paddingVertical: 40, gap: 10 }]}>
      <View style={[styles.center, styles.emptyIcon]}>
        <Ionicons name={icon} size={28} color={colors.brand} />
      </View>
      <Text style={type.h3}>{title}</Text>
      {body ? (
        <Text style={[type.small, { textAlign: 'center', maxWidth: 280 }]}>{body}</Text>
      ) : null}
      {action}
    </View>
  );
}

export function Notice({
  tone = 'blue',
  icon = 'information-circle',
  children,
}: {
  tone?: 'blue' | 'orange' | 'red' | 'green';
  icon?: IconName;
  children: ReactNode;
}) {
  const t = {
    blue: [colors.brand, colors.brandSoft],
    orange: [colors.orange, colors.orangeSoft],
    red: [colors.red, colors.redSoft],
    green: [colors.green, colors.greenSoft],
  }[tone] as [string, string];
  return (
    <View style={[styles.notice, { backgroundColor: t[1] }]}>
      <Ionicons name={icon} size={18} color={t[0]} />
      <Text style={[type.small, { color: colors.text, flex: 1 }]}>{children}</Text>
    </View>
  );
}

export function Check({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Ionicons name="checkmark-circle" size={20} color={colors.green} />
      <Text style={[type.body, { flex: 1 }]}>{children}</Text>
    </View>
  );
}

const desktopColumn: ViewStyle = {
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
  paddingTop: space.xl,
};

export const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    gap: space.sm,
    minHeight: 52,
  },
  headerSide: { width: 56, justifyContent: 'center' },
  hero: {
    backgroundColor: colors.navy,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: space.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    ...shadow,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.lg,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    gap: space.sm,
  },
  button: {
    minHeight: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: space.lg,
  },
  buttonSmall: { minHeight: 34, borderRadius: radius.sm, paddingHorizontal: space.md },
  buttonText: { fontSize: 16, fontFamily: fonts.semibold, letterSpacing: 0.1 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontFamily: fonts.semibold, color: colors.text },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.ink,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
  },
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.greenSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  error: { color: colors.red, fontSize: 13, fontFamily: fonts.medium },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.brandSoft },
  notice: {
    flexDirection: 'row',
    gap: 10,
    padding: space.md,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  dot: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
});
