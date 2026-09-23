import { loginRequestSchema } from '@zuund/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Logo } from '@/components/Logo';
import { Button, ErrorText, Field, Header, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space, type } from '@/theme';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check your details');
    setBusy(true);
    setErr(null);
    try {
      await login(parsed.data);
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
          <Text style={type.h1}>Welcome back</Text>
          <Text style={type.small}>Sign in to see your buying posts and collectives.</Text>
        </View>
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
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={submit}
        />
        <ErrorText>{err}</ErrorText>
        <Button title="Sign in" onPress={submit} loading={busy} />
        <Button
          variant="ghost"
          title="New to ZUUND? Create an account"
          onPress={() => router.replace('/register')}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
