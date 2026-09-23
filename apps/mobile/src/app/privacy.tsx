import { Text, View } from 'react-native';
import { Avatar, Button, Card, Check, Empty, Header, Loading, Screen } from '@/components/ui';
import { api } from '@/lib/api';
import { useFocusData } from '@/lib/useAsync';
import { space, type } from '@/theme';

export default function Privacy() {
  const { data, reload, refresh, refreshing } = useFocusData(() => api.connections.list('BLOCKED'));
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title="Privacy & Safety" />
      <Card style={{ gap: space.md }}>
        <Check>Your WhatsApp number is never shown to other buyers.</Check>
        <Check>Other buyers see your name, photo, city and what you are buying.</Check>
        <Check>
          Report a person, message or file from its ••• menu. Our team reviews every report.
        </Check>
      </Card>
      <Text style={type.h3}>Blocked buyers</Text>
      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty icon="shield-checkmark-outline" title="You haven't blocked anyone" />
      ) : (
        data.items.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Avatar user={c.otherUser} size={40} />
            <Text style={[type.body, { flex: 1 }]}>{c.otherUser.name}</Text>
            <Button
              small
              variant="outline"
              title="Unblock"
              onPress={() => api.connections.unblock(c.otherUser.id).then(reload)}
            />
          </View>
        ))
      )}
    </Screen>
  );
}
