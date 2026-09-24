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
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space, type } from '@/theme';
import { Option } from './Option';

/** The trip on a holiday Buying Post, as the form holds it (null until chosen). */
export interface HolidayTripDraft {
  travelMonth: string | null;
  travelWeek: number | null;
  adults: number | null;
  /** null until the number of children is chosen; each age null until picked. */
  childAges: (number | null)[] | null;
  nights: number | null;
  hotelCategory: HotelCategory | null;
}

export const EMPTY_TRIP: HolidayTripDraft = {
  travelMonth: null,
  travelWeek: null,
  adults: null,
  childAges: null,
  nights: null,
  hotelCategory: null,
};

/** The first thing missing, or null when the trip is complete. */
export function tripProblem(t: HolidayTripDraft): string | null {
  if (!t.travelMonth) return 'Choose a travel month';
  if (!t.travelWeek) return 'Choose the week you travel';
  if (!t.adults) return 'Choose the number of adults';
  if (!t.childAges) return 'Choose the number of children';
  if (t.childAges.some((a) => a === null)) return "Choose each child's age";
  if (!t.nights) return 'Choose the number of nights';
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
          <Dropdown
            label="Adults"
            hint="12 years and over"
            value={value.adults}
            min={1}
            max={HOLIDAY_LIMITS.maxAdults}
            onChange={(adults) => set({ adults })}
          />
          <View style={s.divider} />
          <Dropdown
            label="Children"
            hint={`Under ${HOLIDAY_LIMITS.maxChildAge + 1}`}
            value={value.childAges?.length ?? null}
            min={0}
            max={HOLIDAY_LIMITS.maxChildren}
            onChange={(n) => {
              const ages = value.childAges ?? [];
              set({
                childAges:
                  n > ages.length
                    ? [...ages, ...Array(n - ages.length).fill(null)]
                    : ages.slice(0, n),
              });
            }}
          />
          {value.childAges?.map((age, i) => (
            <Dropdown
              key={i}
              label={`Child ${i + 1} age`}
              hint="In years"
              value={age}
              min={0}
              max={HOLIDAY_LIMITS.maxChildAge}
              onChange={(a) => {
                const next = [...value.childAges!];
                next[i] = a;
                set({ childAges: next });
              }}
            />
          ))}
        </View>
      </View>

      <View style={{ gap: space.sm }}>
        <Text style={type.h3}>How long?</Text>
        <View style={s.card}>
          <Dropdown
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

const ROW = 48;

/** A label on the left and a select box on the right; tapping opens the list of counts. */
function Dropdown({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const counts = useMemo(
    () => Array.from({ length: max - min + 1 }, (_, i) => min + i),
    [min, max],
  );

  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { fontFamily: fonts.semibold }]}>{label}</Text>
        {hint ? <Text style={type.tiny}>{hint}</Text> : null}
      </View>
      <Pressable
        onPress={() => setOpen(true)}
        style={s.select}
        accessibilityRole="button"
        accessibilityLabel={
          value === null ? `Select ${label.toLowerCase()}` : `${label}: ${value}. Change`
        }
      >
        {value === null ? (
          <Text style={[type.body, { color: colors.faint }]}>Select</Text>
        ) : (
          <Text style={s.count}>{value}</Text>
        )}
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <Pressable style={s.sheet} onPress={() => {}}>
            <Text style={[type.h3, s.sheetTitle]}>{label}</Text>
            <FlatList
              data={counts}
              keyExtractor={String}
              getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
              initialScrollIndex={value === null ? 0 : Math.max(0, value - min - 2)}
              renderItem={({ item }) => {
                const on = item === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    style={[s.item, on && { backgroundColor: colors.brandSoft }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text
                      style={[type.body, on && { color: colors.brand, fontFamily: fonts.semibold }]}
                    >
                      {item}
                    </Text>
                    {on ? <Ionicons name="checkmark" size={20} color={colors.brand} /> : null}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
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
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minWidth: 96,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  count: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.ink,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '70%',
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    overflow: 'hidden',
  },
  sheetTitle: { paddingHorizontal: space.lg, paddingVertical: space.sm },
  item: {
    height: ROW,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
});
