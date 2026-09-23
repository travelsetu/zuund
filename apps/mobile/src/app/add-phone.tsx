import { toE164 } from '@zuund/shared';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { PhoneField } from '@/components/PhoneField';
import { Button, ErrorText, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth, useMe } from '@/lib/auth';
import { space, type } from '@/theme';

/**
 * Accounts created before mobile numbers were required land here once, before
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

  async function save() {
    const e164 = toE164(country, phone);
    setPhoneErr(e164 ? null : 'Enter a valid mobile number');
    if (!e164) return;
    setBusy(true);
    setErr(null);
    try {
      await api.users.updateMe({ phone: e164 });
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
          <Button title="Continue" loading={busy} onPress={save} />
          <Button variant="ghost" title="Log out" onPress={() => void logout()} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: space.sm, marginTop: space.xl }}>
        <Logo size={34} />
        <Text style={[type.h1, { textAlign: 'center' }]}>Add your mobile number</Text>
        <Text style={[type.body, { textAlign: 'center' }]}>
          ZUUND now asks every member for a mobile number. It is never shown to other buyers.
        </Text>
      </View>
      <PhoneField
        country={country}
        onCountryChange={setCountry}
        value={phone}
        onChange={setPhone}
        error={phoneErr}
      />
      <ErrorText>{err}</ErrorText>
    </Screen>
  );
}
