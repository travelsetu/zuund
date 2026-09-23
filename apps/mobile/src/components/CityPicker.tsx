import { Ionicons } from '@expo/vector-icons';
import type { CityDto, CountryDto } from '@zuund/shared';
import { useEffect, useMemo, useState } from 'react';
import { Keyboard, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { geoGuess } from '@/lib/geo';
import { colors, fonts, space, type } from '@/theme';
import { Preloader } from './Preloader';
import { Column, Header, SearchBox, styles } from './ui';

/** "IN" → 🇮🇳 */
export function flag(code: string): string {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/**
 * City field: opens a full-screen search over the chosen country's cities
 * (the catalogue has ~32k worldwide, so results come from the server).
 * The country starts from the current value, else the IP guess, else India.
 */
export function CityPicker({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: CityDto | null;
  onChange: (c: CityDto) => void;
}) {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<string>(value?.countryCode ?? 'IN');
  const [countries, setCountries] = useState<CountryDto[]>([]);
  const [choosingCountry, setChoosingCountry] = useState(false);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CityDto[] | null>(null);

  useEffect(() => {
    if (value) return;
    void geoGuess().then((g) => g.country && setCountry(g.country.code));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    if (!countries.length)
      api.catalog
        .countries()
        .then(setCountries)
        .catch(() => {});
    const t = setTimeout(() => {
      api.catalog
        .cities(country, q)
        .then(setResults)
        .catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(t);
  }, [open, country, q, countries.length]);

  const countryName = countries.find((c) => c.code === country)?.name ?? country;

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={value ? `City: ${value.name}` : 'Select your city'}
      >
        <Ionicons name="location-outline" size={18} color={colors.brand} />
        <Text style={[type.body, { flex: 1, color: value ? colors.ink : colors.faint }]}>
          {value ? `${value.name}${value.state ? `, ${value.state}` : ''}` : 'Select your city'}
        </Text>
        {value ? <Text style={{ fontSize: 16 }}>{flag(value.countryCode)}</Text> : null}
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colors.canvas, paddingHorizontal: space.lg }}
        >
          <Column max={560}>
            <Header
              title={choosingCountry ? 'Select country' : 'Select city'}
              back={false}
              right={
                <Pressable
                  onPress={() => (choosingCountry ? setChoosingCountry(false) : setOpen(false))}
                >
                  <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>
                    {choosingCountry ? 'Back' : 'Close'}
                  </Text>
                </Pressable>
              }
            />
            {choosingCountry ? (
              <CountryList
                countries={countries}
                selected={country}
                onPick={(code) => {
                  setCountry(code);
                  setQ('');
                  setResults(null);
                  setChoosingCountry(false);
                }}
              />
            ) : (
              <>
                <Pressable
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingBottom: space.md,
                  }}
                  onPress={() => setChoosingCountry(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Country: ${countryName}. Change country`}
                >
                  <Text style={{ fontSize: 20 }}>{flag(country)}</Text>
                  <Text style={[type.strong, { flex: 1 }]}>{countryName}</Text>
                  <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>Change</Text>
                </Pressable>
                <SearchBox value={q} onChangeText={setQ} placeholder="Search city" autoFocus />
                <FlatList
                  data={results ?? []}
                  keyExtractor={(c) => c.id}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  ListEmptyComponent={
                    results ? (
                      <Text style={[type.small, { paddingVertical: space.lg }]}>
                        No city matches. Try a nearby larger city.
                      </Text>
                    ) : (
                      <Preloader size={36} />
                    )
                  }
                  renderItem={({ item }) => (
                    <Pressable
                      style={{
                        paddingVertical: 14,
                        borderBottomWidth: 1,
                        borderBottomColor: colors.line,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        Keyboard.dismiss();
                        onChange(item);
                        setOpen(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={type.body}>{item.name}</Text>
                        {item.state ? <Text style={type.small}>{item.state}</Text> : null}
                      </View>
                      {value?.id === item.id ? (
                        <Ionicons name="checkmark" size={20} color={colors.brand} />
                      ) : null}
                    </Pressable>
                  )}
                />
              </>
            )}
          </Column>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export function CountryList({
  countries,
  selected,
  onPick,
}: {
  countries: CountryDto[];
  selected: string;
  onPick: (code: string) => void;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? countries.filter((c) => c.name.toLowerCase().includes(t)) : countries;
  }, [countries, q]);
  return (
    <>
      <SearchBox value={q} onChangeText={setQ} placeholder="Search country" autoFocus />
      <FlatList
        data={shown}
        keyExtractor={(c) => c.code}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={countries.length ? null : <Preloader size={36} />}
        renderItem={({ item }) => (
          <Pressable
            style={{
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
            onPress={() => {
              Keyboard.dismiss();
              onPick(item.code);
            }}
          >
            <Text style={{ fontSize: 20 }}>{flag(item.code)}</Text>
            <Text style={[type.body, { flex: 1 }]}>{item.name}</Text>
            {item.code === selected ? (
              <Ionicons name="checkmark" size={20} color={colors.brand} />
            ) : null}
          </Pressable>
        )}
      />
    </>
  );
}
