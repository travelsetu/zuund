import type { IntentLevel } from '@zuund/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type, fonts } from '@/theme';

export const INTENT_HELP: Record<IntentLevel, string> = {
  INTERESTED: 'Genuinely considering it',
  COMMITTED: 'Will buy if the collective conditions suit me',
  READY: 'Ready to purchase soon if conditions suit me',
};

/** Radio card used for timeline and intent choices. */
export function Option({
  on,
  onPress,
  title,
  body,
  half,
  disabled,
}: {
  on: boolean;
  onPress: () => void;
  title: string;
  body?: string;
  half?: boolean;
  /** Shown but not choosable (e.g. a week that has passed). */
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        s.option,
        half && { width: '48%' },
        on && { borderColor: colors.brand, backgroundColor: colors.brandSoft },
        disabled && { opacity: 0.4 },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ checked: on, disabled: !!disabled }}
    >
      <View style={[s.radio, on && { borderColor: colors.brand }]}>
        {on ? <View style={s.radioDot} /> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontFamily: fonts.semibold }]}>{title}</Text>
        {body ? <Text style={type.small}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
});
