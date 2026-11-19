import { connectDatabase } from '@make-it-ai/database';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { buildContext } from '../src/bootstrap';
import { loadEnv } from '../src/config/env';
import type { AppContext } from '../src/context';

describe('MAKE IT AI API', () => {
  let context: AppContext;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const env = loadEnv({
      ...process.env,
      NODE_ENV: 'test',
      AI_FALLBACK_ORDER: 'local-rules',
      OPENAI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      GEMINI_API_KEY: '',
    });
    const db = await connectDatabase();
    context = await buildContext(env, db);
    app = createApp(context);
  });

  it('reports health with the real storage and provider mode', async () => {
    const response = await request(app).get('/healthz');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', service: 'make-it-ai-api', storage: 'memory' });
    expect(response.body.providers).toEqual(['local-rules']);
  });

  it('registers, authenticates and scopes requests to an organization', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({
      email: 'owner@example.com',
      name: 'Workspace Owner',
      password: 'a-very-long-password',
      organizationName: 'Owner Workspace',
    });
    expect(registered.status).toBe(201);
    expect(registered.body.user).not.toHaveProperty('passwordHash');

    const token = registered.body.tokens.accessToken as string;
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.actor.organizationId).toBe(registered.body.user.organizationRoles && Object.keys(registered.body.user.organizationRoles)[0]);

    const unauthenticated = await request(app).get('/api/v1/projects');
    expect(unauthenticated.status).toBe(401);
  });

  it('stores genuine security scan results and exposes overview counters', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({
      email: 'scanner@example.com',
      name: 'Scanner User',
      password: 'another-long-password',
    });
    const token = registered.body.tokens.accessToken as string;

    const scan = await request(app)
      .post('/api/v1/security/scan')
      .set('Authorization', `Bearer ${token}`)
      .send({ files: [{ path: 'src/app.ts', content: 'eval(userInput);' }] });
    expect(scan.status).toBe(201);
    expect(scan.body.scan.summary.critical).toBeGreaterThan(0);

    const overview = await request(app).get('/api/v1/analytics/overview').set('Authorization', `Bearer ${token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.overview.securityFindings.critical).toBeGreaterThan(0);
    expect(overview.body.overview.storageMode).toBe('memory');
  });
});
