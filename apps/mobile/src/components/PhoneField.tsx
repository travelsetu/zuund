import { Ionicons } from '@expo/vector-icons';
import { dialCode, parsePhoneInput, type CountryDto } from '@zuund/shared';
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { colors, fonts, space, type } from '@/theme';
import { CountryList, flag } from './CityPicker';
import { Column, Header, styles } from './ui';

/**
 * WhatsApp number: country code + national number, formatted as you type.
 * The caller turns it into E.164 with toE164(); the server validates again.
 */
export function PhoneField({
  label = 'WhatsApp number',
  country,
  onCountryChange,
  value,
  onChange,
  error,
  hint = 'Never shown to other buyers.',
}: {
  label?: string;
  country: string;
  onCountryChange: (code: string) => void;
  value: string;
  onChange: (national: string) => void;
  error?: string | null;
  hint?: string;
}) {
  const [picking, setPicking] = useState(false);
  const [countries, setCountries] = useState<CountryDto[]>([]);

  function openPicker() {
    setPicking(true);
    if (!countries.length)
      api.catalog
        .countries()
        .then(setCountries)
        .catch(() => {});
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Pressable
          style={[styles.input, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}
          onPress={openPicker}
          accessibilityRole="button"
          accessibilityLabel={`Country code ${dialCode(country)}. Change`}
        >
          <Text style={{ fontSize: 18 }}>{flag(country)}</Text>
          <Text style={[type.strong]}>{dialCode(country)}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.muted} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={(t) => {
            // Autofill may bring the country code along ("+91 99995 59483", "919999559483").
            const next = parsePhoneInput(country, t);
            if (next.country !== country) onCountryChange(next.country);
            onChange(next.national);
          }}
          placeholder="WhatsApp number"
          placeholderTextColor={colors.faint}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          style={[styles.input, { flex: 1, fontFamily: fonts.regular }]}
          accessibilityLabel={label}
        />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={type.tiny}>{hint}</Text>
      ) : null}

      <Modal
        visible={picking}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPicking(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: colors.canvas, paddingHorizontal: space.lg }}
        >
          <Column max={560}>
            <Header
              title="Country code"
              back={false}
              right={
                <Pressable onPress={() => setPicking(false)}>
                  <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>Close</Text>
                </Pressable>
              }
            />
            <CountryList
              countries={countries}
              selected={country}
              onPick={(code) => {
                onCountryChange(code);
                onChange('');
                setPicking(false);
              }}
            />
          </Column>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
