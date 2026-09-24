import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ChatScreen, MessageThread } from '@/components/MessageThread';
import { Button, Column, Header, Loading, ProductArt } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { colors, space, type } from '@/theme';
import type { CollectiveDto } from '@zuund/shared';

/** Mockup 10 — the collective's group chat. */
export default function Discussion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setC] = useState<CollectiveDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.collectives
      .get(id)
      .then(setC)
      .catch((e) => setErr(errorMessage(e)));
  }, [id]);

  return (
    <ChatScreen>
      <Column>
        <View style={{ paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Header
              align="left"
              title={c ? `${c.car.displayName} Buyers` : 'Discussion'}
              subtitle={c ? `${c.activeMemberCount} members` : undefined}
              right={c ? <ProductArt car={c.car} size="sm" /> : undefined}
            />
          </View>
        </View>
        {err ? (
          <Text style={[type.small, { padding: space.lg }]}>{err}</Text>
        ) : !c ? (
          <Loading />
        ) : c.conversationId && c.membership?.status === 'ACTIVE' ? (
          <MessageThread conversationId={c.conversationId} showNames />
        ) : c.conversationId && c.discussionReadOnly ? (
          // The pass ended: what was said up to then stays readable.
          <MessageThread
            conversationId={c.conversationId}
            showNames
            readOnly={
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={[type.small, { flex: 1 }]}>
                  Your pass has ended. Continue with Elite to take part again.
                </Text>
                <Button small title="Continue" onPress={() => router.back()} />
              </View>
            }
          />
        ) : (
          <Text style={[type.small, { padding: space.lg }]}>
            The discussion opens once you join with a Free or Elite Pass.
          </Text>
        )}
      </Column>
    </ChatScreen>
  );
}
