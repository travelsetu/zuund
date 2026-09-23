import { registerRequestSchema, toE164, type CityDto } from '@zuund/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { CityPicker } from '@/components/CityPicker';
import { Logo } from '@/components/Logo';
import { PhoneField } from '@/components/PhoneField';
import { Button, ErrorText, Field, Header, Screen } from '@/components/ui';
import { geoGuess } from '@/lib/geo';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space, type } from '@/theme';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState<CityDto | null>(null);
  const [phoneCountry, setPhoneCountry] = useState('IN');
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState<string | null>(null);

  // Pre-select the city guessed from the IP; the user confirms or changes it.
  useEffect(() => {
    if (city) return;
    void geoGuess().then((g) => {
      if (g.city) setCity((c) => c ?? g.city);
      if (g.country) setPhoneCountry(g.country.code);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const e164 = toE164(phoneCountry, phone);
    setPhoneErr(e164 ? null : 'Enter a valid mobile number');
    if (!e164) return;
    const parsed = registerRequestSchema.safeParse({
      name,
      email,
      password,
      phone: e164,
      cityId: city?.id,
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check your details');
    setBusy(true);
    setErr(null);
    try {
      await register(parsed.data);
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen>
        <Header />
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Logo size={34} />
          <Text style={type.h1}>Create your account</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>
            Your mobile number and email are never shown to other buyers.
          </Text>
        </View>
        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
        />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <PhoneField
          country={phoneCountry}
          onCountryChange={setPhoneCountry}
          value={phone}
          onChange={setPhone}
          error={phoneErr}
        />
        <CityPicker label="City" value={city} onChange={setCity} />
        <ErrorText>{err}</ErrorText>
        <Button title="Create account" onPress={submit} loading={busy} />
        <Button
          variant="ghost"
          title="I already have an account"
          onPress={() => router.replace('/login')}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
