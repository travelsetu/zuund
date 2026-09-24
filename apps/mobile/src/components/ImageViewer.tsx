import { Ionicons } from '@expo/vector-icons';
import type { FileDto } from '@zuund/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/api';
import { apiFileUrl } from '@/lib/config';
import { openFile } from '@/lib/files';
import { tokens } from '@/lib/tokens';
import { colors, fonts, space } from '@/theme';

const MAX_ZOOM = 5;

/** Headers for GET /api/files/:id: phones send the bearer token, the web its cookie. */
export function fileSource(f: Pick<FileDto, 'url'>) {
  return {
    uri: apiFileUrl(f.url),
    headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : undefined,
  };
}

/**
 * Full-screen image inside the app: pinch to zoom (up to 5×), drag when zoomed,
 * double-tap to zoom in or back out, and a download button (the share sheet on
 * phones, with "Save Image"; a new tab on the web).
 */
export function ImageViewer({ file, onClose }: { file: FileDto | null; onClose: () => void }) {
  return (
    <Modal
      visible={!!file}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* A Modal is its own native root: gestures need their own root view on Android. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        {file ? <Viewer file={file} onClose={onClose} /> : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

function Viewer({ file, onClose }: { file: FileDto; onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  // A Modal is a separate native window, where SafeAreaView reports no insets:
  // take them from the app's provider and pad by hand.
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const reset = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    x.value = withTiming(0);
    y.value = withTiming(0);
    savedX.value = 0;
    savedY.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_ZOOM, Math.max(0.8, savedScale.value * e.scale));
    })
    .onEnd(() => {
      if (scale.value <= 1) reset();
      else savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.value <= 1) return;
      x.value = savedX.value + e.translationX;
      y.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = x.value;
      savedY.value = y.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) reset();
      else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const zoom = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));

  async function download() {
    setSaving(true);
    try {
      if (Platform.OS === 'web') window.open(apiFileUrl(file.url), '_blank', 'noopener');
      else await openFile(file);
    } catch (e) {
      Alert.alert('Could not download', errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={s.backdrop}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
        <Animated.View style={[StyleSheet.absoluteFill, zoom]}>
          <Image
            source={fileSource(file)}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            accessibilityLabel={file.fileName}
          />
        </Animated.View>
      </GestureDetector>
      <View style={[s.bar, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
        <Pressable onPress={onClose} hitSlop={12} style={s.button} accessibilityLabel="Close">
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
        <Text style={s.name} numberOfLines={1}>
          {file.fileName}
        </Text>
        <Pressable
          onPress={download}
          disabled={saving}
          hitSlop={12}
          style={[s.button, saving && { opacity: 0.5 }]}
          accessibilityLabel="Download"
        >
          <Ionicons name="download-outline" size={22} color={colors.white} />
        </Pressable>
      </View>
      <View style={[s.hint, { bottom: insets.bottom + space.lg }]} pointerEvents="none">
        <Text style={s.hintText}>Pinch or double-tap to zoom</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000' },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  name: { flex: 1, color: colors.white, fontFamily: fonts.semibold, fontSize: 15 },
  hint: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  hintText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: fonts.medium },
});
