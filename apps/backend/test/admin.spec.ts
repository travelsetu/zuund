import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  adminAgent,
  createPost,
  db,
  joinCollective,
  payFor,
  registerUser,
  setup,
  teardown,
  teardownAll,
  type Agent,
  type TestContext,
  type TestUser,
} from './helpers';

describe('admin', () => {
  let ctx: TestContext;
  let admin: Agent;
  let rahul: TestUser;
  let postId: string;
  let collectiveId: string;
  let paymentId: string;

  beforeAll(async () => {
    ctx = await setup();
    admin = await adminAgent(ctx);
    rahul = await registerUser(ctx, 'Rahul');
    postId = (await createPost(rahul.agent, ctx.creta, ctx.ahmedabad)).id;
    collectiveId = (await joinCollective(rahul.agent, postId)).id;
    paymentId = (await payFor(rahul.agent, postId, collectiveId)).payment.id;
    await rahul.agent
      .post('/api/reports')
      .send({ targetType: 'COLLECTIVE', targetId: collectiveId, reason: 'test' })
      .catch(() => undefined);
  });
  afterAll(async () => {
    await teardown(ctx);
    await teardownAll();
  });

  const READ_ROUTES = [
    '/api/admin/stats',
    '/api/admin/users',
    '/api/admin/buying-intents',
    '/api/admin/collectives',
    '/api/admin/payments',
    '/api/admin/buying-passes',
    '/api/admin/reports',
    '/api/admin/audit-logs',
  ];

  it('a normal user is refused on every admin route, server-side', async () => {
    for (const r of READ_ROUTES) {
      const res = await rahul.agent.get(r);
      expect(res.status, r).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    }
    expect(
      (await rahul.agent.post(`/api/admin/users/${rahul.id}/action`).send({ action: 'VERIFY' }))
        .status,
    ).toBe(403);
    expect(
      (await rahul.agent.post(`/api/admin/payments/${paymentId}/refund`).send({})).status,
    ).toBe(403);
    expect(await db.auditLog.count({ where: { actorType: 'ADMIN' } })).toBe(0);
  });

  it('an admin can read everything', async () => {
    for (const r of READ_ROUTES) expect((await admin.get(r)).status, r).toBe(200);
    const stats = await admin.get('/api/admin/stats');
    expect(stats.body).toMatchObject({
      users: { total: 2 },
      intents: { active: 1, byCar: [{ car: { displayName: 'Hyundai Creta' }, count: 1 }] },
      passes: { active: 1 },
      payments: { success: 1, revenuePaise: 50000 },
      collectives: { active: 1, activeMemberships: 1 },
    });
    const users = await admin.get(`/api/admin/users?q=${rahul.email}`);
    expect(users.body.items).toHaveLength(1);
    expect(users.body.items[0]).toMatchObject({
      id: rahul.id,
      activeIntentCount: 1,
      activePassCount: 1,
    });
    const intent = await admin.get(`/api/admin/buying-intents/${postId}`);
    expect(intent.body.history).toHaveLength(1);
    expect(intent.body.payments).toHaveLength(1);
    expect(intent.body.passes[0].status).toBe('ACTIVE');
  });

  it('admin actions take effect and each one is audited as ADMIN', async () => {
    const verify = await admin
      .post(`/api/admin/users/${rahul.id}/action`)
      .send({ action: 'VERIFY', note: 'id checked' });
    expect(verify.body.verificationStatus).toBe('VERIFIED');
    expect((await rahul.agent.get('/api/users/me')).body.verificationStatus).toBe('VERIFIED');

    const suspend = await admin
      .post(`/api/admin/users/${rahul.id}/action`)
      .send({ action: 'SUSPEND' });
    expect(suspend.body.status).toBe('SUSPENDED');
    const blocked = await rahul.agent.get('/api/users/me');
    expect(blocked.status).toBe(401);
    expect(blocked.body.error.code).toBe('ACCOUNT_NOT_ACTIVE');
    expect(
      (await admin.post(`/api/admin/users/${rahul.id}/action`).send({ action: 'REACTIVATE' })).body
        .status,
    ).toBe('ACTIVE');

    const closeC = await admin
      .post(`/api/admin/collectives/${collectiveId}/action`)
      .send({ action: 'CLOSE', note: 'spam' });
    expect(closeC.body.status).toBe('CLOSED');
    expect(
      (await admin.post(`/api/admin/collectives/${collectiveId}/action`).send({ action: 'REOPEN' }))
        .body.status,
    ).toBe('ACTIVE');

    const refund = await admin
      .post(`/api/admin/payments/${paymentId}/refund`)
      .send({ note: 'goodwill' });
    expect(refund.body).toMatchObject({ status: 'REFUNDED', refundedAmount: 50000 });
    expect(
      (await db.buyingPass.findFirstOrThrow({ where: { buyingIntentId: postId } })).status,
    ).toBe('REFUNDED');
    expect(
      (await db.collectiveMembership.findFirstOrThrow({ where: { buyingIntentId: postId } }))
        .status,
    ).toBe('REFUNDED');
    expect(
      (await admin.post(`/api/admin/payments/${paymentId}/refund`).send({})).body.error.code,
    ).toBe('REFUND_NOT_ALLOWED');

    const closeI = await admin.post(`/api/admin/buying-intents/${postId}/close`).send({});
    expect(closeI.body.status).toBe('CLOSED');

    const report = await db.report.findFirst();
    if (report) {
      expect(
        (
          await admin
            .post(`/api/admin/reports/${report.id}/action`)
            .send({ action: 'RESOLVE', note: 'done' })
        ).status,
      ).toBe(204);
      expect((await db.report.findUniqueOrThrow({ where: { id: report.id } })).status).toBe(
        'RESOLVED',
      );
    }

    const adminUser = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    const logs = await db.auditLog.findMany({
      where: { actorId: adminUser.id, actorType: 'ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    const actions = logs.map((l) => l.action);
    for (const a of [
      'USER_VERIFY',
      'USER_SUSPEND',
      'USER_REACTIVATE',
      'COLLECTIVE_CLOSE',
      'COLLECTIVE_REOPEN',
      'PAYMENT_REFUND',
      'INTENT_CLOSE',
    ]) {
      expect(actions).toContain(a);
    }
    expect(logs.find((l) => l.action === 'USER_VERIFY')?.metadata).toEqual({ note: 'id checked' });
    const viaApi = await admin.get('/api/admin/audit-logs?action=PAYMENT_REFUND');
    expect(viaApi.body.items[0]).toMatchObject({
      action: 'PAYMENT_REFUND',
      targetId: paymentId,
      actor: { id: adminUser.id },
    });
  });

  it('user and system events are audited with their own actor types', async () => {
    const created = await db.auditLog.findFirst({
      where: { action: 'BUYING_POST_CREATED', targetId: postId },
    });
    expect(created).toMatchObject({ actorId: rahul.id, actorType: 'USER' });
    const activated = await db.auditLog.findFirst({ where: { action: 'BUYING_PASS_ACTIVATED' } });
    expect(activated).toMatchObject({ actorId: rahul.id, actorType: 'SYSTEM' });
    const succeeded = await db.auditLog.findFirst({
      where: { action: 'PAYMENT_SUCCEEDED', targetId: paymentId },
    });
    expect(succeeded?.actorType).toBe('SYSTEM');
    const refunded = await db.auditLog.findFirst({
      where: { action: 'PAYMENT_REFUNDED', targetId: paymentId },
    });
    expect(refunded?.actorType).toBe('SYSTEM');
    expect(
      await db.auditLog.count({
        where: { action: 'PAYMENT_INITIATED', actorType: 'USER', actorId: rahul.id },
      }),
    ).toBe(1);
  });

  it('admins cannot be suspended through the console', async () => {
    const adminUser = await db.user.findFirstOrThrow({ where: { role: 'ADMIN' } });
    expect(
      (await admin.post(`/api/admin/users/${adminUser.id}/action`).send({ action: 'SUSPEND' }))
        .status,
    ).toBe(400);
  });
});
