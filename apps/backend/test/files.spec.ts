import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connect,
  createPost,
  joinCollective,
  payFor,
  PDF,
  PNG,
  registerUser,
  setup,
  teardown,
  teardownAll,
  upload,
  type TestContext,
  type TestUser,
} from './helpers';

describe('files', () => {
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

  it('validates type, extension, content and size', async () => {
    expect(
      (
        await upload(
          rahul.agent,
          Buffer.from('MZ\x90\x00'),
          'setup.exe',
          'application/x-msdownload',
        )
      ).status,
    ).toBe(400);
    expect((await upload(rahul.agent, PNG, 'script.js', 'image/png')).status).toBe(400); // extension disagrees
    const mismatch = await upload(
      rahul.agent,
      Buffer.from('<script>alert(1)</script>'),
      'image.png',
      'image/png',
    );
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.error.message).toMatch(/content does not match/i);
    expect(
      (await upload(rahul.agent, Buffer.alloc(11 * 1024 * 1024, 1), 'big.pdf', 'application/pdf'))
        .status,
    ).toBe(400);
    expect((await rahul.agent.post('/api/files')).status).toBe(400);
    expect(
      (
        await request(ctx.server)
          .post('/api/files')
          .attach('file', PNG, { filename: 'a.png', contentType: 'image/png' })
      ).status,
    ).toBe(401);
  });

  it('serves a file only to people allowed to see it', async () => {
    const up = await upload(rahul.agent, PDF, 'brochure.pdf', 'application/pdf');
    expect(up.status).toBe(201);
    expect(up.body.url).toContain(`/api/files/${up.body.id}`);
    const id = up.body.id as string;

    const own = await rahul.agent.get(`/api/files/${id}`);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toContain('application/pdf');
    expect(own.headers['content-disposition']).toContain('attachment');
    expect(own.headers['x-content-type-options']).toBe('nosniff');

    expect((await request(ctx.server).get(`/api/files/${id}`)).status).toBe(401);
    expect((await outsider.agent.get(`/api/files/${id}`)).status).toBe(403);
    expect((await priya.agent.get(`/api/files/${id}`)).status).toBe(403); // not shared anywhere yet

    // Shared in the collective: active members may read it, nobody else.
    const share = await rahul.agent
      .post(`/api/collectives/${collectiveId}/files`)
      .send({ type: 'DOCUMENT', title: 'Brochure', fileId: id });
    expect(share.status).toBe(201);
    expect((await priya.agent.get(`/api/files/${id}`)).status).toBe(200);
    expect((await outsider.agent.get(`/api/files/${id}`)).status).toBe(403);
    // Removing the share removes access.
    expect((await priya.agent.delete(`/api/shared-files/${share.body.id}`)).status).toBe(403);
    expect((await rahul.agent.delete(`/api/shared-files/${share.body.id}`)).status).toBe(204);
    expect((await priya.agent.get(`/api/files/${id}`)).status).toBe(403);
  });

  it('a message attachment is readable by the conversation members only', async () => {
    await connect(rahul, outsider);
    const conv = (await rahul.agent.post('/api/conversations/direct').send({ userId: outsider.id }))
      .body.id as string;
    const up = await upload(rahul.agent, PNG, 'pic.png', 'image/png');
    await rahul.agent
      .post(`/api/conversations/${conv}/messages`)
      .send({ content: '', attachmentId: up.body.id });
    const read = await outsider.agent.get(`/api/files/${up.body.id}`);
    expect(read.status).toBe(200);
    expect(read.headers['content-disposition']).toContain('inline');
    expect((await priya.agent.get(`/api/files/${up.body.id}`)).status).toBe(403);
  });

  it('a profile photo is visible to any signed-in user; only an own image may be set', async () => {
    const up = await upload(priya.agent, PNG, 'me.png', 'image/png');
    const notMine = await rahul.agent.patch('/api/users/me').send({ photoFileId: up.body.id });
    expect(notMine.status).toBe(400);
    const pdf = await upload(priya.agent, PDF, 'doc.pdf', 'application/pdf');
    expect(
      (await priya.agent.patch('/api/users/me').send({ photoFileId: pdf.body.id })).status,
    ).toBe(400);
    const set = await priya.agent.patch('/api/users/me').send({ photoFileId: up.body.id });
    expect(set.status).toBe(200);
    expect(set.body.photoUrl).toBe(up.body.url);
    expect((await outsider.agent.get(`/api/files/${up.body.id}`)).status).toBe(200);
    expect((await request(ctx.server).get(`/api/files/${up.body.id}`)).status).toBe(401);
  });

  it('shared links and collective file listing are member-only', async () => {
    const link = await priya.agent
      .post(`/api/collectives/${collectiveId}/files`)
      .send({ type: 'LINK', title: 'Review', url: 'https://example.com/review' });
    expect(link.status).toBe(201);
    const badLink = await priya.agent
      .post(`/api/collectives/${collectiveId}/files`)
      .send({ type: 'LINK', title: 'Nope' });
    expect(badLink.body.error.code).toBe('VALIDATION_FAILED');
    expect((await outsider.agent.get(`/api/collectives/${collectiveId}/files`)).status).toBe(403);
    const list = await rahul.agent.get(`/api/collectives/${collectiveId}/files`);
    expect(list.body.items.map((f: { title: string }) => f.title)).toEqual(['Review']);
  });
});
