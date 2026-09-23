import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { VehicleArt } from '@/components/VehicleArt';
import { Button, Column, type IconName } from '@/components/ui';
import { colors, space, type } from '@/theme';

const POINTS: Array<{ icon: IconName; label: string }> = [
  { icon: 'shield-checkmark', label: 'Verified\nprofiles' },
  { icon: 'chatbubbles', label: 'Real\ndiscussions' },
  { icon: 'people', label: 'Decide\ntogether' },
];

/** Mockup 1 — onboarding. Copy avoids deal/discount promises (spec §6, §92). */
export default function Welcome() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <Column max={480}>
        <View style={s.body}>
          <Logo size={48} />
          <Text style={[type.h1, s.center, { marginTop: space.lg }]}>
            People. Purchases.{'\n'}Better Together.
          </Text>
          <Text style={[type.body, s.center, { color: colors.muted, marginTop: space.md }]}>
            Find people who want to buy what you want to buy. Connect, compare notes and decide
            together — each of you buys individually.
          </Text>
          <View style={{ marginVertical: space.xl }}>
            <VehicleArt segment="SUV" hero width={300} />
          </View>
          <View style={s.points}>
            {POINTS.map((p) => (
              <View key={p.label} style={s.point}>
                <View style={s.pointIcon}>
                  <Ionicons name={p.icon} size={24} color={colors.green} />
                </View>
                <Text style={[type.small, s.center, { color: colors.text }]}>{p.label}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ padding: space.lg, gap: space.sm }}>
          <Button title="Get Started" onPress={() => router.push('/register')} />
          <Button
            variant="ghost"
            title="I already have an account"
            onPress={() => router.push('/login')}
          />
        </View>
      </Column>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  center: { textAlign: 'center' },
  points: { flexDirection: 'row', gap: space.lg },
  point: { alignItems: 'center', gap: 8, width: 92 },
  pointIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
