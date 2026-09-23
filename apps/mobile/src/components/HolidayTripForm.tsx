import { Ionicons } from '@expo/vector-icons';
import {
  HOLIDAY_LIMITS,
  HOTEL_CATEGORIES,
  HOTEL_CATEGORY_LABELS,
  TRAVEL_WEEKS,
  formatTravelMonth,
  formatTravelWeek,
  isTravelWeekOpen,
  travelMonthOptions,
  type HotelCategory,
} from '@zuund/shared';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, space, type } from '@/theme';
import { Option } from './Option';
import { styles as ui } from './ui';

/** The trip on a holiday Buying Post, as the form holds it (ages as typed). */
export interface HolidayTripDraft {
  travelMonth: string | null;
  travelWeek: number | null;
  adults: number;
  childAges: string[];
  nights: number;
  hotelCategory: HotelCategory | null;
}

export const EMPTY_TRIP: HolidayTripDraft = {
  travelMonth: null,
  travelWeek: null,
  adults: 2,
  childAges: [],
  nights: 4,
  hotelCategory: null,
};

/** The first thing missing, or null when the trip is complete. */
export function tripProblem(t: HolidayTripDraft): string | null {
  if (!t.travelMonth) return 'Choose a travel month';
  if (!t.travelWeek) return 'Choose the week you travel';
  if (t.childAges.some((a) => !/^\d{1,2}$/.test(a) || Number(a) > HOLIDAY_LIMITS.maxChildAge))
    return `Enter each child's age (0–${HOLIDAY_LIMITS.maxChildAge})`;
  if (!t.hotelCategory) return 'Choose a hotel category';
  return null;
}

/** Travel month and week, travellers (children's ages), nights and hotel category. */
export function HolidayTripForm({
  value,
  onChange,
}: {
  value: HolidayTripDraft;
  onChange: (next: HolidayTripDraft) => void;
}) {
  const months = useMemo(() => travelMonthOptions(), []);
  const set = (patch: Partial<HolidayTripDraft>) => onChange({ ...value, ...patch });

  return (
    <View style={{ gap: space.xl }}>
      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>When do you want to travel?</Text>
        <View style={s.grid}>
          {months.map((m) => (
            <Option
              key={m}
              half
              on={value.travelMonth === m}
              title={formatTravelMonth(m)}
              // A new month means choosing the week again.
              onPress={() => m !== value.travelMonth && set({ travelMonth: m, travelWeek: null })}
            />
          ))}
        </View>
      </View>

      {value.travelMonth ? (
        <View style={{ gap: space.sm }}>
          <Text style={type.h3}>Which week?</Text>
          <View style={s.grid}>
            {TRAVEL_WEEKS.map((w) => {
              const open = isTravelWeekOpen(value.travelMonth!, w);
              return (
                <Option
                  key={w}
                  half
                  disabled={!open}
                  on={value.travelWeek === w}
                  title={`Week ${w}`}
                  body={open ? formatTravelWeek(value.travelMonth!, w) : 'Already passed'}
                  onPress={() => set({ travelWeek: w })}
                />
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>Who is travelling?</Text>
        <View style={s.card}>
          <Stepper
            label="Adults"
            hint="12 years and over"
            value={value.adults}
            min={1}
            max={HOLIDAY_LIMITS.maxAdults}
            onChange={(adults) => set({ adults })}
          />
          <View style={s.divider} />
          <Stepper
            label="Children"
            hint={`Under ${HOLIDAY_LIMITS.maxChildAge + 1}`}
            value={value.childAges.length}
            min={0}
            max={HOLIDAY_LIMITS.maxChildren}
            onChange={(n) =>
              set({
                childAges:
                  n > value.childAges.length
                    ? [...value.childAges, ...Array(n - value.childAges.length).fill('')]
                    : value.childAges.slice(0, n),
              })
            }
          />
          {value.childAges.length ? (
            <View style={s.ages}>
              {value.childAges.map((age, i) => (
                <View key={i} style={{ gap: 4 }}>
                  <Text style={type.tiny}>Child {i + 1} age</Text>
                  <TextInput
                    value={age}
                    onChangeText={(t) => {
                      const next = [...value.childAges];
                      next[i] = t.replace(/\D/g, '').slice(0, 2);
                      set({ childAges: next });
                    }}
                    placeholder="Age"
                    placeholderTextColor={colors.faint}
                    keyboardType="number-pad"
                    maxLength={2}
                    style={[ui.input, s.age]}
                    accessibilityLabel={`Child ${i + 1} age in years`}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>How long?</Text>
        <View style={s.card}>
          <Stepper
            label="Nights"
            value={value.nights}
            min={1}
            max={HOLIDAY_LIMITS.maxNights}
            onChange={(nights) => set({ nights })}
          />
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>Hotel category</Text>
        <View style={s.grid}>
          {HOTEL_CATEGORIES.map((h) => (
            <Option
              key={h}
              half
              on={value.hotelCategory === h}
              title={HOTEL_CATEGORY_LABELS[h]}
              onPress={() => set({ hotelCategory: h })}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function Stepper({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={s.stepper}>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontFamily: fonts.semibold }]}>{label}</Text>
        {hint ? <Text style={type.tiny}>{hint}</Text> : null}
      </View>
      <StepButton
        icon="remove"
        label={`Fewer ${label.toLowerCase()}`}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
      />
      <Text style={s.count} accessibilityLabel={`${value} ${label.toLowerCase()}`}>
        {value}
      </Text>
      <StepButton
        icon="add"
        label={`More ${label.toLowerCase()}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={[s.step, disabled && { opacity: 0.35 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      <Ionicons name={icon} size={20} color={colors.brand} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  card: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.white,
    padding: space.md,
    gap: space.md,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  step: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    minWidth: 28,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.ink,
  },
  ages: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  age: { width: 84, textAlign: 'center' },
});
