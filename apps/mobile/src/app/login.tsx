import { splitE164, toE164 } from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { AuthShell } from '@/components/AuthShell';
import { Logo } from '@/components/Logo';
import { OtpField, useOtpSender } from '@/components/OtpField';
import { PhoneField } from '@/components/PhoneField';
import { Button, ErrorText, Header } from '@/components/ui';
import { ApiRequestError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useIsDesktop } from '@/lib/layout';
import { geoGuess } from '@/lib/geo';
import { space, type } from '@/theme';

/** Sign in with a WhatsApp number and the code sent to it on WhatsApp. */
export default function Login() {
  const desktop = useIsDesktop();
  const { loginWithOtp } = useAuth();
  const otp = useOtpSender();
  // Sent here from sign-up with a number that already has an account.
  const given = useLocalSearchParams<{ phone?: string }>().phone;
  const split = given ? splitE164(given) : null;
  const [country, setCountry] = useState(split?.country ?? 'IN');
  const [phone, setPhone] = useState(split?.national ?? '');
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (split) return;
    void geoGuess().then((g) => g.country && setCountry(g.country.code));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendCode() {
    const e164 = toE164(country, phone);
    setPhoneErr(e164 ? null : 'Enter a valid WhatsApp number');
    if (!e164) return;
    setErr(null);
    try {
      await otp.send(e164);
      setCode('');
    } catch (e) {
      setErr(errorMessage(e));
    }
  }

  async function signIn(entered = code) {
    if (!otp.sentTo || busy) return;
    if (entered.length !== 6) return setErr('Enter the 6-digit code');
    setBusy(true);
    setErr(null);
    try {
      await loginWithOtp({ phone: otp.sentTo, code: entered });
    } catch (e) {
      setBusy(false);
      // A new number: the code is still good, so carry it into sign-up.
      if (e instanceof ApiRequestError && e.body?.error?.code === 'ACCOUNT_NOT_FOUND') {
        router.replace({ pathname: '/register', params: { phone: otp.sentTo, code: entered } });
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
      <AuthShell>
        <Header />
        <View style={{ alignItems: 'center', gap: space.sm }}>
          {desktop ? null : <Logo size={34} />}
          <Text style={type.h1}>Welcome back</Text>
          <Text style={[type.small, { textAlign: 'center' }]}>
            Sign in with your WhatsApp number. We send you a code on WhatsApp.
          </Text>
        </View>

        {otp.sentTo ? (
          <>
            <OtpField
              phone={otp.sentTo}
              value={code}
              onChange={setCode}
              onSubmit={(c) => void signIn(c)}
              wait={otp.wait}
              onResend={() => void sendCode()}
              onChangeNumber={() => {
                otp.reset();
                setCode('');
                setErr(null);
              }}
            />
            <ErrorText>{err}</ErrorText>
            <Button title="Sign in" onPress={() => void signIn()} loading={busy} />
          </>
        ) : (
          <>
            <PhoneField
              country={country}
              onCountryChange={setCountry}
              value={phone}
              onChange={setPhone}
              error={phoneErr}
              hint="The number you use on WhatsApp. Never shown to other buyers."
            />
            <ErrorText>{err}</ErrorText>
            <Button title="Send code on WhatsApp" onPress={sendCode} loading={otp.sending} />
          </>
        )}

        <Button
          variant="ghost"
          title="New to ZUUND? Create an account"
          onPress={() => router.replace('/register')}
        />
      </AuthShell>
    </KeyboardAvoidingView>
  );
}
