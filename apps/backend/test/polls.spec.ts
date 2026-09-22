import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPost,
  db,
  joinCollective,
  payFor,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type TestContext,
  type TestUser,
} from './helpers';

describe('polls', () => {
  let ctx: TestContext;
  let rahul: TestUser;
  let priya: TestUser;
  let outsider: TestUser;
  let collectiveId: string;

  beforeAll(async () => {
    ctx = await setup();
    rahul = await registerUser(ctx, 'Rahul');
    priya = await registerUser(ctx, 'Priya');
    outsider = await registerUser(ctx, 'Outsider');
    const a = (await createPost(rahul.agent, ctx.creta, ctx.ahmedabad)).id;
    const b = (await createPost(priya.agent, ctx.creta, ctx.ahmedabad)).id;
    collectiveId = (await joinCollective(rahul.agent, a)).id;
    await priya.agent.post(`/api/collectives/${collectiveId}/join`).send({ buyingIntentId: b });
    await payFor(rahul.agent, a, collectiveId);
    await payFor(priya.agent, b, collectiveId);
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  const create = (agent: TestUser['agent'], body: Record<string, unknown>) =>
    agent.post(`/api/collectives/${collectiveId}/polls`).send(body);

  it('an active member creates a poll; others are notified', async () => {
    const res = await create(rahul.agent, {
      question: 'Which variant?',
      options: ['S', 'SX', 'SX(O)', 'Other'],
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'ACTIVE',
      multipleChoice: false,
      allowVoteChange: false,
      totalVotes: 0,
    });
    expect(res.body.options.map((o: { label: string }) => o.label)).toEqual([
      'S',
      'SX',
      'SX(O)',
      'Other',
    ]);
    expect(await db.notification.count({ where: { userId: priya.id, type: 'NEW_POLL' } })).toBe(1);
    expect(await db.notification.count({ where: { userId: rahul.id, type: 'NEW_POLL' } })).toBe(0);
    expect(
      await db.auditLog.count({
        where: { action: 'POLL_CREATED', actorId: rahul.id, actorType: 'USER' },
      }),
    ).toBe(1);
  });

  it('validates the poll shape', async () => {
    expect(
      (await create(rahul.agent, { question: 'One?', options: ['only'] })).body.error.code,
    ).toBe('VALIDATION_FAILED');
    expect((await create(rahul.agent, { question: '', options: ['a', 'b'] })).status).toBe(400);
    const past = await create(rahul.agent, {
      question: 'Past?',
      options: ['a', 'b'],
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(past.status).toBe(400);
  });

  it('non-members and unpaid members cannot create or vote', async () => {
    const poll = await db.poll.findFirstOrThrow();
    const opt = await db.pollOption.findFirstOrThrow({ where: { pollId: poll.id } });
    expect((await create(outsider.agent, { question: 'x?', options: ['a', 'b'] })).status).toBe(
      403,
    );
    const vote = await outsider.agent
      .post(`/api/polls/${poll.id}/vote`)
      .send({ optionIds: [opt.id] });
    expect(vote.status).toBe(403);
    expect(vote.body.error.code).toBe('NOT_A_MEMBER');
    const pending = await registerUser(ctx, 'Pending');
    const p = await createPost(pending.agent, ctx.creta, ctx.ahmedabad);
    await pending.agent
      .post(`/api/collectives/${collectiveId}/join`)
      .send({ buyingIntentId: p.id });
    expect(
      (await pending.agent.post(`/api/polls/${poll.id}/vote`).send({ optionIds: [opt.id] })).body
        .error.code,
    ).toBe('BUYING_PASS_REQUIRED');
    expect(await db.pollVote.count()).toBe(0);
  });

  it('single choice: one option, one vote per user, no change unless allowed', async () => {
    const poll = await db.poll.findFirstOrThrow();
    const opts = await db.pollOption.findMany({
      where: { pollId: poll.id },
      orderBy: { sortOrder: 'asc' },
    });
    const two = await priya.agent
      .post(`/api/polls/${poll.id}/vote`)
      .send({ optionIds: [opts[0]!.id, opts[1]!.id] });
    expect(two.body.error.code).toBe('INVALID_VOTE');
    const unknown = await priya.agent
      .post(`/api/polls/${poll.id}/vote`)
      .send({ optionIds: ['00000000-0000-4000-8000-000000000000'] });
    expect(unknown.body.error.code).toBe('INVALID_VOTE');
    const ok = await priya.agent
      .post(`/api/polls/${poll.id}/vote`)
      .send({ optionIds: [opts[1]!.id] });
    expect(ok.status).toBe(201);
    expect(ok.body.totalVotes).toBe(1);
    expect(ok.body.options[1]).toMatchObject({ voteCount: 1, voted: true });
    const again = await priya.agent
      .post(`/api/polls/${poll.id}/vote`)
      .send({ optionIds: [opts[0]!.id] });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('ALREADY_VOTED');
    expect(await db.pollVote.count({ where: { pollId: poll.id, userId: priya.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: 'POLL_VOTED', actorId: priya.id } })).toBe(1);
  });

  it('two simultaneous single-choice votes leave exactly one row', async () => {
    const poll = await db.poll.findFirstOrThrow();
    const opts = await db.pollOption.findMany({
      where: { pollId: poll.id },
      orderBy: { sortOrder: 'asc' },
    });
    const [a, b] = await Promise.all([
      rahul.agent.post(`/api/polls/${poll.id}/vote`).send({ optionIds: [opts[0]!.id] }),
      rahul.agent.post(`/api/polls/${poll.id}/vote`).send({ optionIds: [opts[2]!.id] }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 400]);
    expect(await db.pollVote.count({ where: { pollId: poll.id, userId: rahul.id } })).toBe(1);
  });

  it('multiple choice with vote changes replaces the set', async () => {
    const res = await create(priya.agent, {
      question: 'Colours?',
      options: ['White', 'Black', 'Red'],
      multipleChoice: true,
      allowVoteChange: true,
    });
    const opts = res.body.options as Array<{ id: string }>;
    const first = await rahul.agent
      .post(`/api/polls/${res.body.id}/vote`)
      .send({ optionIds: [opts[0]!.id, opts[2]!.id, opts[2]!.id] });
    expect(first.body.totalVotes).toBe(1);
    expect(first.body.options.map((o: { voteCount: number }) => o.voteCount)).toEqual([1, 0, 1]);
    const changed = await rahul.agent
      .post(`/api/polls/${res.body.id}/vote`)
      .send({ optionIds: [opts[1]!.id] });
    expect(changed.body.options.map((o: { voteCount: number }) => o.voteCount)).toEqual([0, 1, 0]);
    expect(await db.pollVote.count({ where: { pollId: res.body.id, userId: rahul.id } })).toBe(1);
  });

  it('only the creator closes; closed and expired polls reject votes', async () => {
    const poll = await db.poll.findFirstOrThrow({ where: { creatorId: rahul.id } });
    const opts = await db.pollOption.findMany({ where: { pollId: poll.id } });
    const notCreator = await priya.agent.post(`/api/polls/${poll.id}/close`);
    expect(notCreator.status).toBe(403);
    expect(notCreator.body.error.code).toBe('NOT_CREATOR');
    const closed = await rahul.agent.post(`/api/polls/${poll.id}/close`);
    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.closedAt).toBeTruthy();
    const late = await priya.agent
      .post(`/api/polls/${poll.id}/vote`)
      .send({ optionIds: [opts[0]!.id] });
    expect(late.body.error.code).toBe('POLL_CLOSED');
    // Expired-by-time behaves the same before the scheduler closes it.
    const timed = await create(rahul.agent, {
      question: 'Soon?',
      options: ['a', 'b'],
      expiresAt: new Date(Date.now() + 5000).toISOString(),
    });
    await db.poll.update({
      where: { id: timed.body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await priya.agent
      .post(`/api/polls/${timed.body.id}/vote`)
      .send({ optionIds: [timed.body.options[0].id] });
    expect(expired.body.error.code).toBe('POLL_CLOSED');
    const list = await priya.agent.get(`/api/collectives/${collectiveId}/polls`);
    expect(list.body.items.length).toBe(3);
  });
});
