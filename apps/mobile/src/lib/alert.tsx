import { useEffect, useState } from 'react';
import {
  Alert as NativeAlert,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AlertButton,
} from 'react-native';
import { colors, fonts, radius, space, type } from '@/theme';

/**
 * Drop-in for React Native's Alert. Phones get the native dialog; the web build
 * (where react-native-web's Alert cannot show buttons) gets <DialogHost>'s modal.
 */
interface Dialog {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

let show: ((d: Dialog) => void) | null = null;

export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]) {
    if (Platform.OS !== 'web') return NativeAlert.alert(title, message, buttons);
    const list = buttons?.length ? buttons : [{ text: 'OK' }];
    if (show) show({ title, message, buttons: list });
    else window.alert([title, message].filter(Boolean).join('\n\n'));
  },
};

/** Mount once near the root. Renders nothing on iOS/Android. */
export function DialogHost() {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    show = setDialog;
    return () => {
      show = null;
    };
  }, []);
  if (!dialog) return null;
  const close = (b?: AlertButton) => {
    setDialog(null);
    b?.onPress?.();
  };
  const cancel = dialog.buttons.find((b) => b.style === 'cancel');
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(cancel)}>
      <Pressable style={s.backdrop} onPress={() => close(cancel)} accessibilityLabel="Dismiss">
        <Pressable style={s.card} onPress={(e) => e.stopPropagation()} accessibilityRole="alert">
          <Text style={type.h2}>{dialog.title}</Text>
          {dialog.message ? <Text style={type.body}>{dialog.message}</Text> : null}
          <View style={s.buttons}>
            {dialog.buttons.map((b, i) => (
              <Pressable
                key={`${b.text}-${i}`}
                onPress={() => close(b)}
                style={({ pressed }) => [s.button, pressed && { backgroundColor: colors.canvas }]}
                accessibilityRole="button"
              >
                <Text
                  style={{
                    fontFamily: b.style === 'cancel' ? fonts.medium : fonts.semibold,
                    fontSize: 15,
                    color:
                      b.style === 'destructive'
                        ? colors.red
                        : b.style === 'cancel'
                          ? colors.muted
                          : colors.brand,
                  }}
                >
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,30,79,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.md,
  },
  buttons: { gap: 4, marginTop: space.sm },
  button: { paddingVertical: 12, paddingHorizontal: space.md, borderRadius: radius.md },
});
