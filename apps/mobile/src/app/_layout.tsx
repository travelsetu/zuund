import {
  SchibstedGrotesk_400Regular,
  SchibstedGrotesk_500Medium,
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  SchibstedGrotesk_800ExtraBold,
  SchibstedGrotesk_900Black,
  useFonts,
} from '@expo-google-fonts/schibsted-grotesk';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DialogHost } from '@/lib/alert';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useIsDesktop } from '@/lib/layout';
import { keepOpeningLink, takeReturnLink } from '@/lib/returnTo';
import { Sidebar } from '@/components/Sidebar';
import { Preloader } from '@/components/Preloader';
import { colors } from '@/theme';

function RootStack() {
  const { me } = useAuth();
  const desktop = useIsDesktop();
  const signedIn = !!me;
  // Accounts from before mobile numbers were required must add one first.
  const needsPhone = signedIn && !me.phone;
  const ready = signedIn && !needsPhone;
  // Guests look around freely. Once they sign in, carry on where they were: a link they
  // opened that needs an account, or the Buying Post they filled in.
  useEffect(() => {
    if (me === null) keepOpeningLink();
    if (!ready) return;
    const path = takeReturnLink();
    if (!path) return;
    setTimeout(() => {
      if (router.canDismiss()) router.dismissAll();
      router.push(path as never);
    }, 0);
  }, [me, ready]);
  if (me === undefined) return <Preloader fill />;
  const stack = (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      {/* Open to guests too: signing in is asked for when creating a Buying Post. */}
      <Stack.Protected guard={!needsPhone}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" />
        <Stack.Screen name="posts/new" />
        <Stack.Screen name="privacy" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="welcome" />
      </Stack.Protected>
      <Stack.Protected guard={needsPhone}>
        <Stack.Screen name="add-phone" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="change-password" />
        <Stack.Screen name="collectives/[id]/activities" />
        <Stack.Screen name="collectives/[id]/discussion" />
        <Stack.Screen name="collectives/[id]/files" />
        <Stack.Screen name="collectives/[id]/index" />
        <Stack.Screen name="collectives/[id]/members" />
        <Stack.Screen name="collectives/[id]/polls/[pollId]" />
        <Stack.Screen name="collectives/[id]/polls/index" />
        <Stack.Screen name="collectives/[id]/polls/new" />
        <Stack.Screen name="connections" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="messages/[id]" />
        <Stack.Screen name="my-posts" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="posts/[id]/buyers" />
        <Stack.Screen name="posts/[id]/collective" />
        <Stack.Screen name="posts/[id]/failed" />
        <Stack.Screen name="posts/[id]/index" />
        <Stack.Screen name="posts/[id]/pay" />
        <Stack.Screen name="posts/[id]/success" options={{ gestureEnabled: false }} />
        <Stack.Screen name="settings" />
        <Stack.Screen name="users/[id]" />
      </Stack.Protected>
    </Stack>
  );
  if (!ready || !desktop) return stack;
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.canvas }}>
      <Sidebar />
      <View style={{ flex: 1 }}>{stack}</View>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SchibstedGrotesk_400Regular,
    SchibstedGrotesk_500Medium,
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
    SchibstedGrotesk_800ExtraBold,
    SchibstedGrotesk_900Black,
  });
  // If the font fails to load, carry on with the system font rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootStack />
            <DialogHost />
          </AuthProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
