import { Ionicons } from '@expo/vector-icons';
import {
  HOLIDAY_TRIP_TYPES,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type BrandDto,
  type HolidayTripType,
  type CarDto,
  type ProductCategory,
} from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  Chip,
  ChipRow,
  Empty,
  Header,
  Loading,
  ProductArt,
  Screen,
  SearchBox,
} from '@/components/ui';
import { api } from '@/lib/api';
import { atLeast } from '@/lib/minDuration';
import { useIsDesktop } from '@/lib/layout';
import { colors, fonts, radius, space, type } from '@/theme';

/** The brands most Indian buyers start from, shown first. */
const POPULAR_BRANDS = ['Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Kia', 'Toyota'];

/**
 * Filter chips in the order people usually think of them (car body types, holiday
 * regions nearest first); anything else follows alphabetically.
 */
const SEGMENT_ORDER = [
  'SUV',
  'Hatchback',
  'Sedan',
  'MUV',
  'EV',
  'North India',
  'South India',
  'West India',
  'East & North-East',
  'Central India',
  'Islands',
  'Southeast Asia',
  'Middle East',
  'Indian Ocean',
  'South Asia',
  'East Asia',
  'Europe',
];

/** Holidays start from India: the trip type must be chosen before any destination. */
const TRIP_TYPES: Record<
  HolidayTripType,
  { title: string; body: string; icon: 'map' | 'airplane' }
> = {
  Domestic: { title: 'Domestic', body: 'Popular destinations across India', icon: 'map' },
  International: {
    title: 'International',
    body: 'Popular destinations abroad, from India',
    icon: 'airplane',
  },
};

/**
 * Mockup 3 — choose what you are buying.
 * Cars: pick a brand, then a model (filterable by body type). Typing searches
 * all models directly, so "Creta" still jumps straight to Hyundai Creta.
 * Solar: a short list of systems.
 * Holidays: pick Domestic or International first (required), then a destination,
 * filterable by region.
 */
export default function Search() {
  const params = useLocalSearchParams<{ category?: ProductCategory }>();
  const [category, setCategory] = useState<ProductCategory>(params.category ?? 'CAR');
  const [brand, setBrand] = useState<string | null>(null);
  const [segment, setSegment] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [brands, setBrands] = useState<BrandDto[] | null>(null);
  const [results, setResults] = useState<CarDto[] | null>(null);
  const [picked, setPicked] = useState<CarDto | null>(null);
  const resultsEmpty = useRef(true);

  const desktop = useIsDesktop();
  const brandColumns = desktop ? 3 : 1;
  const typing = q.trim().length > 0;
  const showBrands = category === 'CAR' && !brand && !typing;
  const holiday = category === 'HOLIDAY';
  const chooseTripType = holiday && !brand;

  useEffect(() => {
    if (category !== 'CAR') return;
    setBrands(null);
    atLeast(api.catalog.brands('CAR'))
      .then(setBrands)
      .catch(() => setBrands([]));
  }, [category]);

  useEffect(() => {
    if (showBrands || chooseTripType) return;
    const t = setTimeout(() => {
      // Typing searches every car brand, but a holiday search stays within its trip type.
      const scope = typing && !holiday ? undefined : (brand ?? undefined);
      const request = api.catalog.search(q, category, scope);
      // Only an empty list (first load, new brand or category) shows the preloader, so only it waits.
      (resultsEmpty.current ? atLeast(request) : request)
        .then((r) => {
          resultsEmpty.current = false;
          setResults(r);
        })
        .catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(t);
  }, [q, category, brand, typing, showBrands, chooseTripType, holiday]);

  // Body-type chips come from the models on screen, so only real options appear.
  const segments = useMemo(() => {
    const set = new Set((results ?? []).map((c) => c.segment).filter((x): x is string => !!x));
    return [...set].sort(
      (a, b) =>
        (SEGMENT_ORDER.indexOf(a) + 1 || 99) - (SEGMENT_ORDER.indexOf(b) + 1 || 99) ||
        a.localeCompare(b),
    );
  }, [results]);
  const shown = useMemo(
    () => (results ?? []).filter((c) => !segment || c.segment === segment),
    [results, segment],
  );

  function switchCategory(c: ProductCategory) {
    setCategory(c);
    setBrand(null);
    setSegment(null);
    setPicked(null);
    setResults(null);
    resultsEmpty.current = true;
  }

  function openBrand(name: string) {
    Keyboard.dismiss();
    setBrand(name);
    setPicked(null);
    setSegment(null);
    setResults(null);
    resultsEmpty.current = true;
  }

  const title =
    category === 'SOLAR'
      ? 'Choose a solar system'
      : holiday
        ? 'Choose a holiday'
        : 'Choose a car';
  const placeholder = holiday
    ? brand === 'International'
      ? 'Search a destination, e.g. Bali'
      : 'Search a destination, e.g. Goa'
    : brand
      ? `Search ${brand} models`
      : category === 'SOLAR'
        ? 'e.g. 3 kW'
        : 'Search a model, e.g. Creta';

  return (
    <Screen
      scroll={false}
      footer={
        <Button
          variant="green"
          title="Continue"
          disabled={!picked}
          onPress={() =>
            picked &&
            router.push({
              pathname: '/posts/new',
              params: {
                carId: picked.id,
                name: picked.displayName,
                category: picked.category,
                segment: picked.segment ?? '',
              },
            })
          }
        />
      }
    >
      <Header title={title} />
      <View style={{ gap: space.md, paddingBottom: space.md }}>
        <ChipRow>
          {PRODUCT_CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={PRODUCT_CATEGORY_LABELS[c]}
              active={category === c}
              onPress={() => switchCategory(c)}
            />
          ))}
        </ChipRow>
        {chooseTripType ? null : (
          <SearchBox value={q} onChangeText={setQ} placeholder={placeholder} />
        )}
        {brand && (!typing || holiday) ? (
          <Pressable
            onPress={() => {
              setBrand(null);
              setSegment(null);
              setPicked(null);
              setQ('');
            }}
            style={s.crumb}
            accessibilityRole="button"
            accessibilityLabel={holiday ? 'Change trip type' : 'Back to all brands'}
          >
            <Ionicons name="chevron-back" size={16} color={colors.brand} />
            <Text style={s.crumbText}>{holiday ? 'Trip type' : 'All brands'}</Text>
            <Text style={[type.h3, { marginLeft: space.sm }]}>{brand}</Text>
          </Pressable>
        ) : null}
        {!showBrands && !chooseTripType && segments.length > 1 ? (
          <ChipRow>
            <Chip
              label={holiday ? 'All regions' : 'All types'}
              active={!segment}
              onPress={() => setSegment(null)}
            />
            {segments.map((seg) => (
              <Chip
                key={seg}
                label={seg}
                active={segment === seg}
                onPress={() => setSegment(segment === seg ? null : seg)}
              />
            ))}
          </ChipRow>
        ) : null}
      </View>

      {chooseTripType ? (
        <View style={{ gap: space.md, paddingBottom: space.lg }}>
          <View>
            <Text style={type.h3}>Domestic or international?</Text>
            <Text style={type.small}>Holiday packages from India.</Text>
          </View>
          {HOLIDAY_TRIP_TYPES.map((t) => (
            <Pressable
              key={t}
              style={({ pressed }) => [s.trip, pressed && { opacity: 0.85 }]}
              onPress={() => openBrand(t)}
              accessibilityRole="button"
              accessibilityLabel={`${TRIP_TYPES[t].title}: ${TRIP_TYPES[t].body}`}
            >
              <View style={s.tripIcon}>
                <Ionicons name={TRIP_TYPES[t].icon} size={26} color={colors.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h2}>{TRIP_TYPES[t].title}</Text>
                <Text style={type.small}>{TRIP_TYPES[t].body}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.faint} />
            </Pressable>
          ))}
        </View>
      ) : showBrands ? (
        <FlatList
          // One brand per row on phones; a grid when a desktop browser has the room.
          key={`brands-${brandColumns}`}
          data={brands ?? []}
          numColumns={brandColumns}
          keyExtractor={(b) => b.name}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          columnWrapperStyle={brandColumns > 1 ? { gap: space.sm } : undefined}
          ListEmptyComponent={brands ? null : <Loading />}
          ListHeaderComponent={
            brands?.length ? (
              <View style={{ gap: space.sm, marginBottom: space.sm }}>
                <Text style={type.h3}>Popular</Text>
                <ChipRow>
                  {POPULAR_BRANDS.filter((name) => brands.some((b) => b.name === name)).map(
                    (name) => (
                      <Pressable
                        key={name}
                        style={({ pressed }) => [s.popular, pressed && { opacity: 0.85 }]}
                        onPress={() => openBrand(name)}
                        accessibilityRole="button"
                      >
                        <View style={s.monogram}>
                          <Text style={s.monogramText}>{name.charAt(0)}</Text>
                        </View>
                        <Text style={type.strong}>{name}</Text>
                      </Pressable>
                    ),
                  )}
                </ChipRow>
                <Text style={[type.h3, { marginTop: space.sm }]}>All brands</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [s.brand, pressed && { opacity: 0.85 }]}
              onPress={() => openBrand(item.name)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${item.count} models`}
            >
              {/* A monogram rather than the manufacturer's logo (those are trademarks). */}
              <View style={s.monogram}>
                <Text style={s.monogramText}>{item.name.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.h3} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={type.tiny}>
                  {item.count} {item.count === 1 ? 'model' : 'models'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.faint} />
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          key="models"
          data={shown}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ gap: space.sm, paddingBottom: space.lg }}
          ListEmptyComponent={
            !results ? (
              <Loading />
            ) : (
              <Empty
                icon="search"
                title="Nothing found"
                body={
                  category === 'SOLAR'
                    ? 'Try a size, like “3 kW”.'
                    : holiday
                      ? 'Try another destination, or switch between Domestic and International.'
                      : 'Try the brand or model name, like “Creta”.'
                }
              />
            )
          }
          renderItem={({ item }) => {
            const on = picked?.id === item.id;
            return (
              <Pressable
                style={[
                  s.item,
                  on && { borderColor: colors.brand, backgroundColor: colors.brandSoft },
                ]}
                onPress={() => {
                  // Picking a result is the end of typing: put the keyboard away.
                  Keyboard.dismiss();
                  setPicked(item);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
              >
                <ProductArt car={item} size="sm" />
                <View style={{ flex: 1 }}>
                  <Text style={type.h3}>
                    {holiday || (brand && !typing) ? item.model : item.displayName}
                  </Text>
                  <Text style={type.small}>
                    {item.segment ?? PRODUCT_CATEGORY_LABELS[item.category]}
                  </Text>
                </View>
                <Ionicons
                  name={on ? 'checkmark-circle' : 'chevron-forward'}
                  size={on ? 22 : 18}
                  color={on ? colors.brand : colors.faint}
                />
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: colors.white,
  },
  brand: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  monogram: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: { fontFamily: fonts.heavy, fontSize: 18, color: colors.brand },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  popular: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  crumbText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.brand },
  trip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  tripIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
