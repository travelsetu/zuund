import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JobsService } from '../src/jobs/jobs.service';
import {
  createPost,
  db,
  joinCollective,
  payFor,
  registerUser,
  setup,
  teardown,
  teardownAll,
  useFreePass,
  type TestContext,
  type TestUser,
} from './helpers';

describe('collective membership', () => {
  let ctx: TestContext;
  let rahul: TestUser;
  let priya: TestUser;
  let rahulPost: string;
  let priyaPost: string;
  let collectiveId: string;

  beforeAll(async () => {
    ctx = await setup();
    rahul = await registerUser(ctx, 'Rahul');
    priya = await registerUser(ctx, 'Priya');
    // These specs follow the paid path: both have used their Free Pass for this car+city.
    await useFreePass(rahul, ctx.creta, ctx.ahmedabad);
    await useFreePass(priya, ctx.creta, ctx.ahmedabad);
    rahulPost = (await createPost(rahul.agent, ctx.creta, ctx.ahmedabad)).id;
    priyaPost = (await createPost(priya.agent, ctx.creta, ctx.ahmedabad)).id;
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it('creating returns one collective per car+city, with the creator pending payment', async () => {
    const c = await joinCollective(rahul.agent, rahulPost);
    collectiveId = c.id;
    expect(c.membership?.status).toBe('PENDING_PAYMENT');
    expect(c.conversationId).toBeNull();
    const again = await joinCollective(priya.agent, priyaPost);
    expect(again.id).toBe(collectiveId);
    expect(await db.collective.count()).toBe(1);
    expect(await db.collectiveMembership.count({ where: { collectiveId } })).toBe(2);
  });

  it('a post for another car or city cannot join', async () => {
    const other = await registerUser(ctx, 'Other');
    const surat = await createPost(other.agent, ctx.creta, ctx.surat);
    const res = await other.agent
      .post(`/api/collectives/${collectiveId}/join`)
      .send({ buyingIntentId: surat.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INTENT_MISMATCH');
    const venue = await createPost(other.agent, ctx.venue, ctx.ahmedabad);
    expect(
      (
        await other.agent
          .post(`/api/collectives/${collectiveId}/join`)
          .send({ buyingIntentId: venue.id })
      ).body.error.code,
    ).toBe('INTENT_MISMATCH');
  });

  it('no duplicate live membership: joining again is a no-op, joining via another post is refused', async () => {
    const again = await rahul.agent
      .post(`/api/collectives/${collectiveId}/join`)
      .send({ buyingIntentId: rahulPost });
    expect(again.status).toBe(201);
    expect(await db.collectiveMembership.count({ where: { collectiveId, userId: rahul.id } })).toBe(
      1,
    );
    // Two simultaneous joins from the same post: still one row.
    const [a, b] = await Promise.all([
      rahul.agent.post(`/api/collectives/${collectiveId}/join`).send({ buyingIntentId: rahulPost }),
      rahul.agent.post(`/api/collectives/${collectiveId}/join`).send({ buyingIntentId: rahulPost }),
    ]);
    expect([a.status, b.status].every((s) => s === 201 || s === 409)).toBe(true);
    expect(
      await db.collectiveMembership.count({
        where: { collectiveId, userId: rahul.id, status: { in: ['PENDING_PAYMENT', 'ACTIVE'] } },
      }),
    ).toBe(1);
    // The database refuses a second live row outright.
    await expect(
      db.collectiveMembership.create({
        data: { collectiveId, userId: rahul.id, buyingIntentId: rahulPost, status: 'ACTIVE' },
      }),
    ).rejects.toThrow();
  });

  it("someone else's post cannot be used to join", async () => {
    const res = await priya.agent
      .post(`/api/collectives/${collectiveId}/join`)
      .send({ buyingIntentId: rahulPost });
    expect(res.status).toBe(403);
  });

  it('payment turns the membership ACTIVE and adds the member to the discussion', async () => {
    await payFor(rahul.agent, rahulPost, collectiveId);
    const c = await rahul.agent.get(`/api/collectives/${collectiveId}`);
    expect(c.body.membership.status).toBe('ACTIVE');
    expect(c.body.activeMemberCount).toBe(1);
    expect(c.body.conversationId).toBeTruthy();
    const members = await rahul.agent.get(`/api/collectives/${collectiveId}/members`);
    expect(members.body.items.map((m: { user: { id: string } }) => m.user.id)).toEqual([rahul.id]);
    expect(JSON.stringify(members.body)).not.toContain(rahul.phone.slice(3));
    // Priya, still pending, sees the collective but not its content.
    const p = await priya.agent.get(`/api/collectives/${collectiveId}`);
    expect(p.body.membership.status).toBe('PENDING_PAYMENT');
    expect(p.body.conversationId).toBeNull();
    expect((await priya.agent.get(`/api/collectives/${collectiveId}/polls`)).body.error.code).toBe(
      'BUYING_PASS_REQUIRED',
    );
  });

  it('leaving keeps every record, removes discussion access, and does not refund by default', async () => {
    const conv = (await rahul.agent.get(`/api/collectives/${collectiveId}`)).body
      .conversationId as string;
    expect((await rahul.agent.get(`/api/conversations/${conv}/messages`)).status).toBe(200);
    const leave = await rahul.agent.post(`/api/collectives/${collectiveId}/leave`);
    expect(leave.status).toBe(204);
    const m = await db.collectiveMembership.findFirstOrThrow({
      where: { collectiveId, userId: rahul.id },
    });
    expect(m.status).toBe('LEFT');
    expect(m.leftAt).toBeTruthy();
    expect((await rahul.agent.get(`/api/conversations/${conv}/messages`)).status).toBe(403);
    expect((await rahul.agent.get(`/api/collectives/${collectiveId}`)).body.membership).toBeNull();
    // Post, payment and pass are untouched (REFUND_ON_LEAVE=NONE).
    expect((await db.buyingIntent.findUniqueOrThrow({ where: { id: rahulPost } })).status).toBe(
      'ACTIVE',
    );
    expect(
      (await db.payment.findFirstOrThrow({ where: { buyingIntentId: rahulPost } })).status,
    ).toBe('SUCCESS');
    expect(
      (await db.buyingPass.findFirstOrThrow({ where: { buyingIntentId: rahulPost } })).status,
    ).toBe('ACTIVE');
    expect(
      await db.auditLog.count({
        where: { action: 'COLLECTIVE_LEFT', actorId: rahul.id, actorType: 'USER' },
      }),
    ).toBe(1);
    // Leaving twice is refused. (Currently a 404 from a NotFoundException in CollectivesService.leave;
    // the rest of the API says NOT_A_MEMBER/403 for the same condition — noted in the report.)
    expect([403, 404]).toContain(
      (await rahul.agent.post(`/api/collectives/${collectiveId}/leave`)).status,
    );
  });

  it('an expired pass expires the membership; the discussion becomes read-only', async () => {
    await payFor(priya.agent, priyaPost, collectiveId);
    const conv = (await priya.agent.get(`/api/collectives/${collectiveId}`)).body
      .conversationId as string;
    expect((await priya.agent.get(`/api/conversations/${conv}/messages`)).status).toBe(200);
    const pass = await db.buyingPass.findFirstOrThrow({
      where: { buyingIntentId: priyaPost, status: 'ACTIVE' },
    });
    await db.buyingPass.update({
      where: { id: pass.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await ctx.app.get(JobsService).expirePasses();
    expect(
      (await db.collectiveMembership.findFirstOrThrow({ where: { buyingIntentId: priyaPost } }))
        .status,
    ).toBe('EXPIRED');
    // History stays readable; nothing can be posted.
    expect((await priya.agent.get(`/api/conversations/${conv}/messages`)).status).toBe(200);
    expect(
      (await priya.agent.post(`/api/conversations/${conv}/messages`).send({ content: 'hi' }))
        .status,
    ).toBe(403);
    const polls = await priya.agent.get(`/api/collectives/${collectiveId}/polls`);
    expect(polls.body.error.code).toBe('BUYING_PASS_EXPIRED');
    expect((await priya.agent.get(`/api/collectives/${collectiveId}`)).body.activeMemberCount).toBe(
      0,
    );
  });

  it('a closed collective cannot be joined', async () => {
    await db.collective.update({
      where: { id: collectiveId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    const late = await registerUser(ctx, 'Late');
    const post = await createPost(late.agent, ctx.creta, ctx.ahmedabad);
    const res = await late.agent
      .post(`/api/collectives/${collectiveId}/join`)
      .send({ buyingIntentId: post.id });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('COLLECTIVE_CLOSED');
  });
});
