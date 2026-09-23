import { toE164 } from '@zuund/shared';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { OtpField, useOtpSender } from '@/components/OtpField';
import { PhoneField } from '@/components/PhoneField';
import { Button, ErrorText, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth, useMe } from '@/lib/auth';
import { space, type } from '@/theme';

/**
 * Accounts created before WhatsApp numbers were required land here once, before
 * anything else. Saving the number reloads the session and the app opens as usual.
 */
export default function AddPhone() {
  const me = useMe();
  const { reload, logout } = useAuth();
  const [country, setCountry] = useState(me.city?.countryCode ?? 'IN');
  const [phone, setPhone] = useState('');
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const otp = useOtpSender();
  const [code, setCode] = useState('');

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

  async function save(entered = code) {
    if (!otp.sentTo) return sendCode();
    if (entered.length !== 6) return setErr('Enter the 6-digit code');
    setBusy(true);
    setErr(null);
    try {
      await api.users.updateMe({ phone: otp.sentTo, phoneCode: entered });
      await reload();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title={otp.sentTo ? 'Continue' : 'Send code on WhatsApp'}
            loading={busy || otp.sending}
            onPress={() => void save()}
          />
          <Button variant="ghost" title="Log out" onPress={() => void logout()} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: space.sm, marginTop: space.xl }}>
        <Logo size={34} />
        <Text style={[type.h1, { textAlign: 'center' }]}>Add your WhatsApp number</Text>
        <Text style={[type.body, { textAlign: 'center' }]}>
          ZUUND now signs you in with your mobile number and a code on WhatsApp. It is never shown
          to other buyers.
        </Text>
      </View>
      {otp.sentTo ? (
        <OtpField
          phone={otp.sentTo}
          value={code}
          onChange={setCode}
          onSubmit={(c) => void save(c)}
          wait={otp.wait}
          onResend={() => void sendCode()}
          onChangeNumber={() => {
            otp.reset();
            setCode('');
          }}
        />
      ) : (
        <PhoneField
          country={country}
          onCountryChange={setCountry}
          value={phone}
          onChange={setPhone}
          error={phoneErr}
          hint="We send a code on WhatsApp to confirm it. Never shown to other buyers."
        />
      )}
      <ErrorText>{err}</ErrorText>
    </Screen>
  );
}
