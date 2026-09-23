import { Ionicons } from '@expo/vector-icons';
import { formatPhone, type OtpPurpose } from '@zuund/shared';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api, ApiRequestError } from '@/lib/api';
import { colors, fonts, space, type } from '@/theme';
import { styles } from './ui';

/**
 * Sending the WhatsApp code: remembers which number it went to and counts down
 * until another may be sent. `send` throws API errors for the caller to show.
 */
export function useOtpSender(alreadySentTo: string | null = null) {
  const [sentTo, setSentTo] = useState<string | null>(alreadySentTo);
  const [wait, setWait] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = useCallback(async (phone: string, purpose: OtpPurpose = 'login') => {
    setSending(true);
    try {
      const r = await api.auth.sendOtp({ phone, purpose });
      setSentTo(phone);
      setWait(r.resendInSeconds);
    } catch (e) {
      // A code went to this number moments ago and still works: just show the entry.
      const retry = (e as ApiRequestError).body?.error?.details as
        { retryAfterSeconds?: number } | undefined;
      if (e instanceof ApiRequestError && e.body?.error?.code === 'OTP_TOO_SOON') {
        setSentTo(phone);
        setWait(retry?.retryAfterSeconds ?? 30);
        return;
      }
      throw e;
    } finally {
      setSending(false);
    }
  }, []);

  const reset = useCallback(() => setSentTo(null), []);
  return { sentTo, wait, sending, send, reset };
}

/** "+91 98765 43210", for telling people where the code went. */
export const prettyPhone = formatPhone;

/** The 6-digit WhatsApp code, with resend and change-number links. */
export function OtpField({
  phone,
  value,
  onChange,
  onSubmit,
  wait,
  onResend,
  onChangeNumber,
  error,
}: {
  phone: string;
  value: string;
  onChange: (code: string) => void;
  /** Called once all six digits are in. */
  onSubmit?: (code: string) => void;
  wait: number;
  onResend: () => void;
  onChangeNumber?: () => void;
  error?: string | null;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Ionicons name="logo-whatsapp" size={22} color={colors.green} />
        <Text style={[type.body, { flex: 1 }]}>
          Enter the 6-digit code we sent on WhatsApp to{' '}
          <Text style={{ fontFamily: fonts.semibold, color: colors.ink }}>
            {prettyPhone(phone)}
          </Text>
        </Text>
      </View>
      <TextInput
        value={value}
        onChangeText={(t) => {
          const code = t.replace(/\D/g, '').slice(0, 6);
          onChange(code);
          if (code.length === 6) onSubmit?.(code);
        }}
        placeholder="6-digit code"
        placeholderTextColor={colors.faint}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus
        maxLength={6}
        style={[
          styles.input,
          // Spaced-out digits once typed; the placeholder keeps normal spacing.
          value
            ? { fontFamily: fonts.bold, fontSize: 24, letterSpacing: 10, textAlign: 'center' }
            : { fontSize: 17, letterSpacing: 0, textAlign: 'center' },
        ]}
        accessibilityLabel="WhatsApp code"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {onChangeNumber ? (
          <Pressable onPress={onChangeNumber} hitSlop={8} accessibilityRole="button">
            <Text style={link}>Change number</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          onPress={onResend}
          disabled={wait > 0}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: wait > 0 }}
        >
          <Text style={[link, wait > 0 && { color: colors.faint }]}>
            {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const link = { fontFamily: fonts.semibold, fontSize: 14, color: colors.brand } as const;
