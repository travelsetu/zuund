import { registerRequestSchema, splitE164, toE164, type CityDto } from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { CityPicker } from '@/components/CityPicker';
import { Logo } from '@/components/Logo';
import { OtpField, prettyPhone, useOtpSender } from '@/components/OtpField';
import { PhoneField } from '@/components/PhoneField';
import { Button, ErrorText, Field, Header, Notice, Screen } from '@/components/ui';
import { geoGuess } from '@/lib/geo';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space, type } from '@/theme';

/**
 * Sign-up: name, WhatsApp number (confirmed with a code sent on WhatsApp) and
 * city. Arriving from sign-in with an unknown number, the code that
 * was already entered there is carried over (`phone`, `code` params).
 */
export default function Register() {
  const { register } = useAuth();
  const carried = useLocalSearchParams<{ phone?: string; code?: string }>();
  const hasCarried = !!(carried.phone && carried.code);
  const otp = useOtpSender(hasCarried ? carried.phone! : null);
  const [name, setName] = useState('');
  const [city, setCity] = useState<CityDto | null>(null);
  const [phoneCountry, setPhoneCountry] = useState(
    (hasCarried && splitE164(carried.phone!)?.country) || 'IN',
  );
  const [phone, setPhone] = useState((hasCarried && splitE164(carried.phone!)?.national) || '');
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [code, setCode] = useState(hasCarried ? carried.code! : '');
  /** The code from sign-in is in use; dropped if it turns out to have expired. */
  const [useCarried, setUseCarried] = useState(hasCarried);

  // Pre-select the city guessed from the IP; the user confirms or changes it.
  useEffect(() => {
    if (city) return;
    void geoGuess().then((g) => {
      if (g.city) setCity((c) => c ?? g.city);
      if (g.country && !hasCarried) setPhoneCountry(g.country.code);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function changeNumber() {
    otp.reset();
    setCode('');
    setErr(null);
  }

  /** Checks the form, then sends the WhatsApp code to the number. */
  async function sendCode() {
    const e164 = toE164(phoneCountry, phone);
    setPhoneErr(e164 ? null : 'Enter a valid WhatsApp number');
    if (!e164) return;
    const parsed = registerRequestSchema.safeParse({
      name,
      phone: e164,
      code: '000000',
      cityId: city?.id,
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check your details');
    setErr(null);
    try {
      await otp.send(e164);
      setCode('');
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function create(entered = code) {
    if (!otp.sentTo || busy) return;
    const parsed = registerRequestSchema.safeParse({
      name,
      phone: otp.sentTo,
      code: entered,
      cityId: city?.id,
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check your details');
    setBusy(true);
    setErr(null);
    try {
      await register(parsed.data);
    } catch (e) {
      setBusy(false);
      if (useCarried && e instanceof ApiRequestError && e.body?.error?.code === 'OTP_INVALID') {
        // The code from sign-in has expired: show the number again so a new one can be sent.
        setUseCarried(false);
        changeNumber();
        setErr('That code has expired. Send a new one.');
        return;
      }
      setErr(errorMessage(e));
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
            Your WhatsApp number is never shown to other buyers.
          </Text>
        </View>
        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
        />
        {useCarried && otp.sentTo ? (
          <Notice tone="green" icon="checkmark-circle">
            {prettyPhone(otp.sentTo)} confirmed on WhatsApp.
          </Notice>
        ) : (
          <PhoneField
            country={phoneCountry}
            onCountryChange={(c) => {
              setPhoneCountry(c);
              changeNumber();
            }}
            value={phone}
            onChange={(v) => {
              setPhone(v);
              if (otp.sentTo) changeNumber();
            }}
            error={phoneErr}
            hint="The number you use on WhatsApp; you sign in with a code sent there. Never shown to other buyers."
          />
        )}
        <CityPicker label="City" value={city} onChange={setCity} />
        {otp.sentTo && !useCarried ? (
          <OtpField
            phone={otp.sentTo}
            value={code}
            onChange={setCode}
            onSubmit={(c) => void create(c)}
            wait={otp.wait}
            onResend={() => void sendCode()}
            onChangeNumber={changeNumber}
          />
        ) : null}
        <ErrorText>{err}</ErrorText>
        {otp.sentTo ? (
          <Button title="Create account" onPress={() => void create()} loading={busy} />
        ) : (
          <Button title="Send code on WhatsApp" onPress={sendCode} loading={otp.sending} />
        )}
        <Button
          variant="ghost"
          title="I already have an account"
          onPress={() => router.replace('/login')}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
