import pg from 'pg';
import { createApp } from '../src/app';
import type { Config } from '../src/config';
import type { GoogleOAuth, GoogleProfile } from '../src/google';
import { signSession } from '../src/session';
import { migrate } from '../scripts/migrate';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://localhost:5432/stepsquad_test';

export const config: Config = {
  sessionSecret: 'test-secret-test-secret-test-secret-123',
  publicUrl: 'https://api.test',
  googleClientId: 'client-id',
  googleClientSecret: 'client-secret',
  allowedRedirectPrefixes: ['step-squad://', 'exp://'],
  corsOrigins: [],
  sessionTtlSeconds: 3600,
};

export const pool = new pg.Pool({ connectionString: TEST_DATABASE_URL });

export const query = async (text: string, params?: unknown[]) =>
  (await pool.query(text, params as any[])).rows;

export const fakeGoogle = {
  next: { sub: 'g-1', email: 'a@example.com', name: 'Alice', picture: 'https://pic/a' } as GoogleProfile,
  codes: [] as string[],
};

const google: GoogleOAuth = {
  authorizationUrl: ({ state, redirectUri }) =>
    `https://accounts.google.test/auth?state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`,
  async exchangeCode(code) {
    fakeGoogle.codes.push(code);
    if (code === 'bad') throw new Error('bad code');
    return fakeGoogle.next;
  },
};

export const app = createApp({ config, query, google });

export async function setupDb() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(TEST_DATABASE_URL);
}

export async function resetData() {
  await pool.query('TRUNCATE users CASCADE');
}

export async function createUser(email: string, name = email.split('@')[0]) {
  const [user] = await query(
    `INSERT INTO users (email, full_name) VALUES ($1, $2) RETURNING id`,
    [email, name]
  );
  await query(`INSERT INTO profiles (id, display_name) VALUES ($1, $2)`, [user.id, name]);
  return { id: user.id as string, token: await signSession(config, user.id) };
}

export async function call(
  token: string | null,
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  return app.request(path, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
