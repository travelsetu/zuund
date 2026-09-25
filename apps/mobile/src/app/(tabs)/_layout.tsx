import { Tabs } from 'expo-router/js-tabs';
import { TabBar } from '@/components/TabBar';
import { useAuth } from '@/lib/auth';

export default function TabsLayout() {
  const signedIn = !!useAuth().me;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      {/* Guests have Home; the tab bar offers "Log in" in place of the rest. */}
      <Tabs.Protected guard={signedIn}>
        <Tabs.Screen name="collectives" />
        <Tabs.Screen name="messages" />
        <Tabs.Screen name="profile" />
      </Tabs.Protected>
    </Tabs>
  );
}
