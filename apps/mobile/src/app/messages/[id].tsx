import type { ConversationDto } from '@zuund/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ChatScreen, MessageThread } from '@/components/MessageThread';
import { Avatar, Column, Header, Loading } from '@/components/ui';
import { api } from '@/lib/api';
import { colors, space } from '@/theme';

/** One-to-one chat between connected buyers. */
export default function DirectChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [conv, setConv] = useState<ConversationDto | null>(null);
  useEffect(() => {
    api.conversations
      .get(id)
      .then((c) =>
        c.type === 'COLLECTIVE' && c.collectiveId
          ? router.replace(`/collectives/${c.collectiveId}/discussion`)
          : setConv(c),
      )
      .catch(() => {});
  }, [id]);
  const other = conv?.otherUser;
  return (
    <ChatScreen>
      <Column>
        <View style={{ paddingHorizontal: space.lg }}>
          <Header
            align="left"
            title={other?.name ?? 'Message'}
            subtitle={other?.city?.name}
            right={
              other ? (
                <Pressable onPress={() => router.push(`/users/${other.id}`)}>
                  <Avatar user={other} size={34} />
                </Pressable>
              ) : undefined
            }
          />
        </View>
        {conv ? <MessageThread conversationId={id} showNames={false} /> : <Loading />}
      </Column>
    </ChatScreen>
  );
}
