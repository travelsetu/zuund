import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connect,
  createPost,
  joinCollective,
  payFor,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type TestContext,
  type TestUser,
} from './helpers';

describe('collective member list', () => {
  let ctx: TestContext;
  let a: TestUser;
  let b: TestUser;
  let c: TestUser;
  let collectiveId: string;

  beforeAll(async () => {
    ctx = await setup();
    [a, b, c] = [
      await registerUser(ctx, 'A'),
      await registerUser(ctx, 'B'),
      await registerUser(ctx, 'C'),
    ];
    for (const u of [a, b, c]) {
      const post = await createPost(u.agent, ctx.creta, ctx.ahmedabad);
      collectiveId = (await joinCollective(u.agent, post.id)).id;
      await payFor(u.agent, post.id, collectiveId);
    }
    await connect(a, b);
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  it("carries the viewer's connection with each member", async () => {
    const res = await a.agent.get(`/api/collectives/${collectiveId}/members`);
    expect(res.status).toBe(200);
    const by = Object.fromEntries(
      res.body.items.map((m: { user: { id: string }; connection: unknown }) => [
        m.user.id,
        m.connection,
      ]),
    );
    expect(by[a.id]).toBeNull();
    expect(by[b.id]).toMatchObject({ status: 'ACCEPTED', requesterId: a.id });
    expect(by[c.id]).toBeNull();
  });

  it('mine=false lists every collective, mine=true only live memberships', async () => {
    const outsider = await registerUser(ctx, 'Outsider');
    const all = await outsider.agent.get('/api/collectives?mine=false');
    expect(all.body.items.map((x: { id: string }) => x.id)).toContain(collectiveId);
    const mine = await outsider.agent.get('/api/collectives?mine=true');
    expect(mine.body.items).toEqual([]);
  });
});
