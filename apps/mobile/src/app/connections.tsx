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
import { EliteBadge, UpgradeCard, UsageRow, upgradeAlertFor } from '@/components/Plan';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
  const { me, reload: reloadMe } = useAuth();
  const pass = me?.pass ?? null;
  const run = (p: Promise<unknown>) =>
    p
      .then(() => Promise.all([reload(), reloadMe()]))
      .catch((e) => {
        if (!upgradeAlertFor(e, me)) Alert.alert('Could not update', errorMessage(e));
      });

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Header title="My Connections" />
      {pass ? (
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <UsageRow
              label="Active"
              used={pass.activeConnections}
              limit={pass.activeConnectionsLimit}
            />
          </View>
          <View style={{ flex: 1 }}>
            <UsageRow
              label="Total"
              used={pass.acceptedConnections}
              limit={pass.acceptedConnectionsLimit}
            />
          </View>
        </View>
      ) : null}
      {pass?.plan === 'FREE' && pass.activeConnections >= pass.activeConnectionsLimit ? (
        <UpgradeCard
          title="You've reached your Free Pass limit"
          body="Elite allows 30 active and 60 total connections."
          buyingIntentId={pass.buyingIntentId}
        />
      ) : null}
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={type.h3}>{c.otherUser.name}</Text>
                  {c.otherUser.elite ? <EliteBadge small /> : null}
                </View>
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
