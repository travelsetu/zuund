import type { ConnectionStatus } from '@zuund/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Alert } from '@/lib/alert';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { upgradeAlertFor } from './Plan';
import { Button } from './ui';

export interface ConnectionRef {
  id: string;
  status: ConnectionStatus;
  requesterId: string;
}

/**
 * The one button that reflects a relationship: Connect → Requested → (Accept) → Message.
 * The server keeps one row per pair, so a crossed request simply shows Accept. Elite
 * members also get "Message" before connecting (a direct-message credit); a plan limit
 * turns into an "Upgrade to Elite" prompt.
 */
export function ConnectButton({
  userId,
  meId,
  connection,
  onChange,
  small = true,
}: {
  userId: string;
  meId: string;
  connection: ConnectionRef | null;
  onChange: (c: ConnectionRef | null) => void;
  small?: boolean;
}) {
  const { me, reload } = useAuth();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (!upgradeAlertFor(e, me)) Alert.alert('Could not update', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const message = () =>
    run(async () => {
      const conv = await api.conversations.openDirect(userId);
      router.push(`/messages/${conv.id}`);
    });

  if (connection?.status === 'BLOCKED') return null;
  if (connection?.status === 'ACCEPTED') {
    return (
      <Button
        small={small}
        variant="outline"
        title="Message"
        icon="chatbubble-outline"
        loading={busy}
        onPress={message}
      />
    );
  }
  if (connection?.status === 'PENDING') {
    if (connection.requesterId === meId) {
      return (
        <Button
          small={small}
          variant="ghost"
          title="Requested"
          icon="time-outline"
          loading={busy}
          onPress={() =>
            Alert.alert('Cancel request?', undefined, [
              { text: 'Keep', style: 'cancel' },
              {
                text: 'Cancel request',
                style: 'destructive',
                onPress: () =>
                  run(async () => {
                    await api.connections.cancel(connection.id);
                    onChange(null);
                  }),
              },
            ])
          }
        />
      );
    }
    return (
      <Button
        small={small}
        variant="green"
        title="Accept"
        loading={busy}
        onPress={() =>
          run(async () => {
            const c = await api.connections.accept(connection.id);
            onChange({ id: c.id, status: c.status, requesterId: c.requesterId });
          })
        }
      />
    );
  }
  const connect = (
    <Button
      small={small}
      variant="outline"
      title="Connect"
      loading={busy}
      onPress={() =>
        run(async () => {
          const c = await api.connections.request(userId);
          onChange({ id: c.id, status: c.status, requesterId: c.requesterId });
          void reload(); // connection usage on the pass
        })
      }
    />
  );
  if (me?.pass?.plan !== 'ELITE') return connect;
  return (
    <View style={{ gap: 6, alignItems: 'flex-end' }}>
      {connect}
      <Button
        small={small}
        variant="ghost"
        title="Message"
        icon="chatbubble-outline"
        onPress={() =>
          run(async () => {
            const conv = await api.conversations.openDirect(userId);
            void reload(); // a credit may have been spent
            router.push(`/messages/${conv.id}`);
          })
        }
      />
    </View>
  );
}
