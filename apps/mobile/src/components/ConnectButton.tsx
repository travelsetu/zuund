import type { ConnectionStatus } from '@zuund/shared';
import { router } from 'expo-router';
import { useState } from 'react';

import { Alert } from '@/lib/alert';
import { api, errorMessage } from '@/lib/api';
import { Button } from './ui';

export interface ConnectionRef {
  id: string;
  status: ConnectionStatus;
  requesterId: string;
}

/**
 * The one button that reflects a relationship: Connect → Requested → (Accept) → Message.
 * The server keeps one row per pair, so a crossed request simply shows Accept.
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
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Could not update', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (connection?.status === 'BLOCKED') return null;
  if (connection?.status === 'ACCEPTED') {
    return (
      <Button
        small={small}
        variant="outline"
        title="Message"
        icon="chatbubble-outline"
        loading={busy}
        onPress={() =>
          run(async () => {
            const conv = await api.conversations.openDirect(userId);
            router.push(`/messages/${conv.id}`);
          })
        }
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
  return (
    <Button
      small={small}
      variant="outline"
      title="Connect"
      loading={busy}
      onPress={() =>
        run(async () => {
          const c = await api.connections.request(userId);
          onChange({ id: c.id, status: c.status, requesterId: c.requesterId });
        })
      }
    />
  );
}
