import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Alert } from '@/lib/alert';
import { Card, Header, ListRow, Screen } from '@/components/ui';
import { useAuth, useMe } from '@/lib/auth';
import { SUPPORT_EMAIL } from '@/lib/config';

/** Mockup 14 — settings and account. */
export default function Settings() {
  const { logout } = useAuth();
  const me = useMe();
  return (
    <Screen>
      <Header title="Settings" />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <ListRow
          icon="person-circle-outline"
          title="Account Settings"
          onPress={() => router.push('/edit-profile')}
        />
        <ListRow
          icon="document-text-outline"
          title="My Buying Posts"
          onPress={() => router.push('/my-posts')}
        />
        <ListRow
          icon="people-outline"
          title="My Collectives"
          onPress={() => router.push('/collectives')}
        />
        <ListRow
          icon="person-add-outline"
          title="My Connections"
          onPress={() => router.push('/connections')}
        />
        <ListRow
          icon="card-outline"
          title="Payment History"
          onPress={() => router.push('/payments')}
        />
        <ListRow
          icon="notifications-outline"
          title="Notifications"
          onPress={() => router.push('/notifications')}
        />
        <ListRow
          icon="shield-checkmark-outline"
          title="Privacy & Safety"
          onPress={() => router.push('/privacy')}
        />
        {me.hasPassword ? (
          <ListRow
            icon="key-outline"
            title="Change Password"
            onPress={() => router.push('/change-password')}
          />
        ) : null}
        <ListRow
          icon="help-circle-outline"
          title="Help & Support"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
      </Card>
      <View>
        <Card style={{ padding: 0 }}>
          <ListRow
            danger
            icon="log-out-outline"
            title="Logout"
            onPress={() =>
              Alert.alert('Log out of ZUUND?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log out', style: 'destructive', onPress: () => void logout() },
              ])
            }
          />
        </Card>
      </View>
    </Screen>
  );
}
