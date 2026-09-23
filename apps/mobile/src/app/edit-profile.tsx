import { splitE164, toE164, type CityDto } from '@zuund/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CityPicker } from '@/components/CityPicker';
import { OtpField, useOtpSender } from '@/components/OtpField';
import { PhoneField } from '@/components/PhoneField';
import { Avatar, Button, ErrorText, Field, Header, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth, useMe } from '@/lib/auth';
import { pickImage } from '@/lib/files';
import { colors, space, type, fonts } from '@/theme';

export default function EditProfile() {
  const me = useMe();
  const { reload } = useAuth();
  const [name, setName] = useState(me.name ?? '');
  const [about, setAbout] = useState(me.about ?? '');
  const [city, setCity] = useState<CityDto | null>(me.city);
  const initialPhone = me.phone ? splitE164(me.phone) : null;
  const [phoneCountry, setPhoneCountry] = useState(
    initialPhone?.country ?? me.city?.countryCode ?? 'IN',
  );
  const [phone, setPhone] = useState(initialPhone?.national ?? '');
  const [phoneErr, setPhoneErr] = useState<string | null>(null);
  // A new number is confirmed with a WhatsApp code before it is saved.
  const otp = useOtpSender();
  const [code, setCode] = useState('');
  const e164 = toE164(phoneCountry, phone);
  const phoneChanged = !!e164 && e164 !== me.phone;
  const needsCode = phoneChanged && otp.sentTo !== e164;
  const [photo, setPhoto] = useState<{ id: string; uri: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function choosePhoto() {
    try {
      const f = await pickImage();
      if (!f) return;
      setBusy(true);
      const up = await api.files.upload(f);
      setPhoto({ id: up.id, uri: f.uri });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
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
    setPhoneErr(e164 ? null : 'Enter a valid WhatsApp number');
    if (!e164) return;
    if (needsCode) return sendCode();
    if (phoneChanged && entered.length !== 6) return setErr('Enter the 6-digit code');
    setBusy(true);
    setErr(null);
    try {
      await api.users.updateMe({
        ...(phoneChanged ? { phone: e164, phoneCode: entered } : {}),
        name: name.trim(),
        about: about.trim() || null,
        cityId: city?.id ?? null,
        ...(photo ? { photoFileId: photo.id } : {}),
      });
      await reload();
      router.back();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <Button
          title={needsCode ? 'Send code to new number' : 'Save'}
          loading={busy || otp.sending}
          onPress={() => void save()}
        />
      }
    >
      <Header title="Edit Profile" />
      <Pressable
        style={{ alignItems: 'center', gap: space.sm }}
        onPress={choosePhoto}
        accessibilityRole="button"
      >
        <Avatar user={{ name, photoUrl: photo?.uri ?? me.photoUrl }} size={96} />
        <Text style={{ color: colors.brand, fontFamily: fonts.semibold }}>Change photo</Text>
      </Pressable>
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} />
      <PhoneField
        country={phoneCountry}
        onCountryChange={setPhoneCountry}
        value={phone}
        onChange={setPhone}
        error={phoneErr}
        hint={
          phoneChanged
            ? 'We send a code on WhatsApp to confirm the new number.'
            : me.phone && !me.phoneVerified
              ? 'Not confirmed yet. Never shown to other buyers.'
              : 'Never shown to other buyers.'
        }
      />
      {phoneChanged && otp.sentTo === e164 ? (
        <OtpField
          phone={e164}
          value={code}
          onChange={setCode}
          onSubmit={(c) => void save(c)}
          wait={otp.wait}
          onResend={() => void sendCode()}
        />
      ) : null}
      <CityPicker label="City" value={city} onChange={setCity} />
      <Field
        label="About"
        value={about}
        onChangeText={setAbout}
        multiline
        maxLength={500}
        placeholder="Looking to buy a Creta. Open to connecting with serious buyers."
      />
      {me.email ? (
        <View>
          <Text style={type.small}>Email: {me.email}</Text>
          <Text style={type.tiny}>Your email is never shown to other buyers.</Text>
        </View>
      ) : null}
      <ErrorText>{err}</ErrorText>
    </Screen>
  );
}
