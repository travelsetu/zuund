'use client';

import type { ConversationDto } from '@zuund/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { MessageThread } from '@/components/MessageThread';
import { api } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';

function Conversation({ id }: { id: string }) {
  const { user } = useAuth();
  const [conv, setConv] = useState<ConversationDto | null>(null);

  useEffect(() => {
    api.conversations
      .get(id)
      .then(setConv)
      .catch(() => {});
  }, [id]);

  return (
    <div className="stack">
      <div className="row">
        <Link href="/messages" className="small">
          ← Messages
        </Link>
      </div>
      {conv?.otherUser && (
        <Link href={`/buyers/${conv.otherUser.id}`} className="row" style={{ color: 'inherit' }}>
          <Avatar user={conv.otherUser} />
          <strong>{conv.otherUser.name ?? 'Buyer'}</strong>
        </Link>
      )}
      {conv?.collectiveId && (
        <Link
          href={`/collectives/${conv.collectiveId}`}
          className="row"
          style={{ color: 'inherit' }}
        >
          <span className="avatar">👥</span>
          <strong>Collective discussion</strong>
        </Link>
      )}
      <MessageThread conversationId={id} viewerId={user!.id} showSender={!!conv?.collectiveId} />
    </div>
  );
}

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  return (
    <RequireAuth>
      <Conversation id={conversationId} />
    </RequireAuth>
  );
}
