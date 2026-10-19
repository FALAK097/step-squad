import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { jwtVerify } from 'jose';
import { app, call, config, createUser, fakeGoogle, pool, query, resetData, setupDb } from './helpers';

beforeAll(setupDb);
beforeEach(resetData);
afterAll(() => pool.end());

const secret = new TextEncoder().encode(config.sessionSecret);

describe('auth', () => {
  const start = (redirect: string) =>
    app.request(`/auth/google/start?redirect_uri=${encodeURIComponent(redirect)}`);

  async function signIn(redirect = 'step-squad://') {
    const res = await start(redirect);
    expect(res.status).toBe(302);
    const location = new URL(res.headers.get('location')!);
    const state = location.searchParams.get('state')!;
    const cookie = res.headers.get('set-cookie')!.split(';')[0];
    return { state, cookie };
  }

  const callback = (state: string, cookie: string | null, extra = 'code=abc') =>
    app.request(`/auth/google/callback?${extra}&state=${encodeURIComponent(state)}`, {
      headers: cookie ? { cookie } : {},
    });

  it('rejects redirect_uris outside the allowlist', async () => {
    expect((await start('https://evil.example')).status).toBe(400);
    expect((await start('')).status).toBe(400);
  });

  it('completes the Google flow, creates user + profile, and redirects with a session token', async () => {
    const { state, cookie } = await signIn('exp://192.168.1.2:8081/--/');
    const res = await callback(state, cookie);
    expect(res.status).toBe(302);
    const location = res.headers.get('location')!;
    expect(location.startsWith('exp://192.168.1.2:8081/--/#')).toBe(true);
    const params = new URLSearchParams(location.split('#')[1]);
    const token = params.get('access_token')!;
    const { payload } = await jwtVerify(token, secret, { audience: 'session' });

    const [user] = await query(`SELECT * FROM users WHERE id = $1`, [payload.sub]);
    expect(user).toMatchObject({ email: 'a@example.com', google_sub: 'g-1', full_name: 'Alice' });
    const [profile] = await query(`SELECT * FROM profiles WHERE id = $1`, [payload.sub]);
    expect(profile).toMatchObject({ display_name: 'Alice', step_goal: 10000 });

    const me = await call(token, 'GET', '/me');
    expect(await me.json()).toMatchObject({ id: payload.sub, email: 'a@example.com' });
  });

  it('signing in again reuses the same user', async () => {
    const first = await signIn();
    await callback(first.state, first.cookie);
    const second = await signIn();
    await callback(second.state, second.cookie);
    expect(await query(`SELECT 1 FROM users`)).toHaveLength(1);
  });

  it('links an imported (email-only) user instead of creating a duplicate', async () => {
    const existing = await createUser('a@example.com', 'Old Name');
    const { state, cookie } = await signIn();
    const res = await callback(state, cookie);
    const params = new URLSearchParams(res.headers.get('location')!.split('#')[1]);
    const { payload } = await jwtVerify(params.get('access_token')!, secret);
    expect(payload.sub).toBe(existing.id);
    expect(await query(`SELECT 1 FROM users`)).toHaveLength(1);
    const [u] = await query(`SELECT google_sub FROM users`);
    expect(u.google_sub).toBe('g-1');
    const [p] = await query(`SELECT display_name FROM profiles`);
    expect(p.display_name).toBe('Old Name'); // existing profile is not overwritten
  });

  it('rejects a callback without the matching nonce cookie or with a forged state', async () => {
    const { state } = await signIn();
    expect((await callback(state, null)).status).toBe(400);
    expect((await callback('garbage', null)).status).toBe(400);
  });

  it('redirects back to the app with an error when the user cancels or Google fails', async () => {
    const a = await signIn();
    const denied = await callback(a.state, a.cookie, 'error=access_denied');
    expect(denied.headers.get('location')).toBe('step-squad://#error=access_denied');

    const b = await signIn();
    const failed = await callback(b.state, b.cookie, 'code=bad');
    expect(failed.headers.get('location')).toBe('step-squad://#error=sign_in_failed');
    expect(fakeGoogle.codes).toContain('bad');
  });

  it('requires a valid bearer token on API routes', async () => {
    expect((await call(null, 'GET', '/me')).status).toBe(401);
    expect((await call('nope', 'GET', '/squads')).status).toBe(401);
  });
});
