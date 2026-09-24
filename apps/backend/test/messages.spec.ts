import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connect,
  db,
  PNG,
  joinedUser,
  registerUser,
  setup,
  teardown,
  teardownAll,
  upload,
  type TestContext,
  type TestUser,
} from './helpers';

describe('messages', () => {
  let ctx: TestContext;
  let rahul: TestUser;
  let priya: TestUser;
  let amit: TestUser;
  let conversationId: string;

  beforeAll(async () => {
    ctx = await setup();
    rahul = await joinedUser(ctx, 'Rahul');
    priya = await joinedUser(ctx, 'Priya');
    amit = await joinedUser(ctx, 'Amit');
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('on a Free Pass, a direct conversation needs an accepted connection', async () => {
    const res = await rahul.agent.post('/api/conversations/direct').send({ userId: priya.id });
    expect(res.status).toBe(403);
    // Messaging someone you're not connected with is an Elite Pass feature.
    expect(res.body.error.code).toBe('ELITE_REQUIRED');
    const req = await rahul.agent.post('/api/connections').send({ userId: priya.id });
    expect(
      (await rahul.agent.post('/api/conversations/direct').send({ userId: priya.id })).status,
    ).toBe(403); // still pending
    expect((await priya.agent.post(`/api/connections/${req.body.id}/accept`)).body.status).toBe(
      'ACCEPTED',
    );
    const open = await rahul.agent.post('/api/conversations/direct').send({ userId: priya.id });
    expect(open.status).toBe(201);
    expect(open.body.type).toBe('DIRECT');
    expect(open.body.otherUser.id).toBe(priya.id);
    conversationId = open.body.id;
    const again = await priya.agent.post('/api/conversations/direct').send({ userId: rahul.id });
    expect(again.body.id).toBe(conversationId);
  });

  it('only members read or write; empty messages are rejected', async () => {
    expect((await amit.agent.get(`/api/conversations/${conversationId}/messages`)).status).toBe(
      403,
    );
    expect(
      (
        await amit.agent
          .post(`/api/conversations/${conversationId}/messages`)
          .send({ content: 'hi' })
      ).status,
    ).toBe(403);
    expect((await amit.agent.get(`/api/conversations/${conversationId}`)).status).toBe(403);
    const empty = await rahul.agent
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: '   ' });
    expect(empty.status).toBe(400);
  });

  it('sends a message and tracks SENT → DELIVERED → READ from the sender view', async () => {
    const sent = await rahul.agent
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: 'Which variant are you considering?' });
    expect(sent.status).toBe(201);
    expect(sent.body).toMatchObject({
      messageType: 'TEXT',
      deliveryState: 'SENT',
      sender: { id: rahul.id },
    });
    expect(sent.body.sender).not.toHaveProperty('email');

    let mine = await rahul.agent.get(`/api/conversations/${conversationId}/messages`);
    expect(mine.body.items[0].deliveryState).toBe('SENT');
    const list = await priya.agent.get('/api/conversations');
    expect(list.body.items[0]).toMatchObject({ id: conversationId, unreadCount: 1 });

    await priya.agent.get(`/api/conversations/${conversationId}/messages`); // fetching = delivered
    mine = await rahul.agent.get(`/api/conversations/${conversationId}/messages`);
    expect(mine.body.items[0].deliveryState).toBe('DELIVERED');

    expect((await priya.agent.post(`/api/conversations/${conversationId}/read`)).status).toBe(204);
    mine = await rahul.agent.get(`/api/conversations/${conversationId}/messages`);
    expect(mine.body.items[0].deliveryState).toBe('READ');
    expect((await priya.agent.get('/api/conversations')).body.items[0].unreadCount).toBe(0);
    expect(await db.notification.count({ where: { userId: priya.id, type: 'NEW_MESSAGE' } })).toBe(
      1,
    );
  });

  it('attachments must be the sender’s own upload; reactions toggle; deleting blanks the content', async () => {
    const file = await upload(priya.agent, PNG, 'photo.png', 'image/png');
    expect(file.status).toBe(201);
    const stolen = await rahul.agent
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: '', attachmentId: file.body.id });
    expect(stolen.status).toBe(404);
    const withFile = await priya.agent
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: '', attachmentId: file.body.id });
    expect(withFile.status).toBe(201);
    expect(withFile.body.messageType).toBe('ATTACHMENT');
    expect(withFile.body.attachment.id).toBe(file.body.id);

    expect(
      (await rahul.agent.post(`/api/messages/${withFile.body.id}/reactions`).send({ emoji: '👍' }))
        .status,
    ).toBe(204);
    let msgs = await priya.agent.get(`/api/conversations/${conversationId}/messages`);
    expect(msgs.body.items[0].reactions).toEqual([{ emoji: '👍', count: 1, reacted: false }]);
    await rahul.agent.post(`/api/messages/${withFile.body.id}/reactions`).send({ emoji: '👍' });
    msgs = await priya.agent.get(`/api/conversations/${conversationId}/messages`);
    expect(msgs.body.items[0].reactions).toEqual([]);

    expect((await rahul.agent.delete(`/api/messages/${withFile.body.id}`)).status).toBe(403);
    expect((await priya.agent.delete(`/api/messages/${withFile.body.id}`)).status).toBe(204);
    msgs = await rahul.agent.get(`/api/conversations/${conversationId}/messages`);
    expect(msgs.body.items[0]).toMatchObject({
      content: '',
      attachment: null,
      deletedAt: expect.any(String),
    });
  });

  it('a blocked pair can neither open nor send', async () => {
    await priya.agent.post('/api/connections/block').send({ userId: rahul.id });
    const send = await rahul.agent
      .post(`/api/conversations/${conversationId}/messages`)
      .send({ content: 'still there?' });
    expect(send.status).toBe(403);
    expect(send.body.error.code).toBe('BLOCKED');
    const open = await rahul.agent.post('/api/conversations/direct').send({ userId: priya.id });
    expect(open.status).toBe(403);
    // The blocker cannot message either: the connection is no longer ACCEPTED.
    expect(
      (await priya.agent.post('/api/conversations/direct').send({ userId: rahul.id })).status,
    ).toBe(403);
  });

  it('paginates older messages with a cursor', async () => {
    await connect(rahul, amit);
    const conv = (await rahul.agent.post('/api/conversations/direct').send({ userId: amit.id }))
      .body.id as string;
    for (let i = 0; i < 5; i++)
      await rahul.agent.post(`/api/conversations/${conv}/messages`).send({ content: `m${i}` });
    const page1 = await amit.agent.get(`/api/conversations/${conv}/messages?limit=2`);
    expect(page1.body.items.map((m: { content: string }) => m.content)).toEqual(['m4', 'm3']);
    const page2 = await amit.agent.get(
      `/api/conversations/${conv}/messages?limit=2&cursor=${encodeURIComponent(page1.body.nextCursor)}`,
    );
    expect(page2.body.items.map((m: { content: string }) => m.content)).toEqual(['m2', 'm1']);
    const page3 = await amit.agent.get(
      `/api/conversations/${conv}/messages?limit=2&cursor=${encodeURIComponent(page2.body.nextCursor)}`,
    );
    expect(page3.body.items.map((m: { content: string }) => m.content)).toEqual(['m0']);
    expect(page3.body.nextCursor).toBeNull();
  });
});
