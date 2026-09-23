import { useState } from 'react';

import { Alert } from '@/lib/alert';
import { Button, ErrorText, Field, Header, Screen } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function ChangePassword() {
  const { logout } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (next.length < 8) return setErr('New password must be at least 8 characters');
    setBusy(true);
    setErr(null);
    try {
      await api.auth.changePassword({ currentPassword: current, newPassword: next });
      // The server ends every session on a password change, this one included.
      Alert.alert('Password changed', 'Please sign in again with your new password.');
      await logout();
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title="Change password" loading={busy} onPress={save} />}>
      <Header title="Change Password" />
      <Field
        label="Current password"
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="current-password"
      />
      <Field
        label="New password"
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        placeholder="At least 8 characters"
      />
      <ErrorText>{err}</ErrorText>
    </Screen>
  );
}
