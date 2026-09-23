import type { ConnectionDto } from '@zuund/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import {
  Avatar,
  Button,
  Chip,
  ChipRow,
  Empty,
  Header,
  Loading,
  Screen,
  Verified,
} from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useFocusData } from '@/lib/useAsync';
import { colors, space, type } from '@/theme';

type Box = 'ACCEPTED' | 'INCOMING' | 'OUTGOING';
const LABEL: Record<Box, string> = {
  ACCEPTED: 'Connected',
  INCOMING: 'Requests',
  OUTGOING: 'Sent',
};

export default function Connections() {
  const [box, setBox] = useState<Box>('ACCEPTED');
  const { data, reload, refresh, refreshing } = useFocusData(
    () => api.connections.list(box),
    [box],
  );
  const run = (p: Promise<unknown>) =>
    p.then(reload).catch((e) => Alert.alert('Could not update', errorMessage(e)));

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title="My Connections" />
      <ChipRow>
        {(Object.keys(LABEL) as Box[]).map((b) => (
          <Chip key={b} label={LABEL[b]} active={box === b} onPress={() => setBox(b)} />
        ))}
      </ChipRow>
      {!data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <Empty
          icon="people-outline"
          title={box === 'INCOMING' ? 'No requests' : 'Nobody here yet'}
          body="Find buyers from any of your Buying Posts."
        />
      ) : (
        <View>
          {data.items.map((c: ConnectionDto) => (
            <Pressable
              key={c.id}
              style={s.row}
              onPress={() => router.push(`/users/${c.otherUser.id}`)}
            >
              <Avatar user={c.otherUser} size={46} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={type.h3}>{c.otherUser.name}</Text>
                {c.otherUser.verificationStatus === 'VERIFIED' ? (
                  <View style={{ alignSelf: 'flex-start' }}>
                    <Verified small />
                  </View>
                ) : null}
                {c.otherUser.city ? <Text style={type.small}>{c.otherUser.city.name}</Text> : null}
              </View>
              {box === 'ACCEPTED' ? (
                <Button
                  small
                  variant="outline"
                  title="Message"
                  onPress={() =>
                    api.conversations
                      .openDirect(c.otherUser.id)
                      .then((v) => router.push(`/messages/${v.id}`))
                      .catch((e) => Alert.alert('', errorMessage(e)))
                  }
                />
              ) : box === 'INCOMING' ? (
                <View style={{ gap: 6 }}>
                  <Button
                    small
                    variant="green"
                    title="Accept"
                    onPress={() => run(api.connections.accept(c.id))}
                  />
                  <Button
                    small
                    variant="ghost"
                    title="Decline"
                    onPress={() => run(api.connections.reject(c.id))}
                  />
                </View>
              ) : (
                <Button
                  small
                  variant="ghost"
                  title="Cancel"
                  onPress={() => run(api.connections.cancel(c.id))}
                />
              )}
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});
