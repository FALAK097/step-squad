import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app, call, config, pool, query, setupDb, TEST_DATABASE_URL } from './helpers';
import { signSession } from '../src/session';

/**
 * Simulates a Supabase database (auth.users, auth.identities + public tables with the
 * columns the app used) and runs scripts/import-from-supabase.ts against the Neon schema.
 */
const SOURCE_DB = 'stepsquad_supabase_sim';
const adminUrl = new URL(TEST_DATABASE_URL);
adminUrl.pathname = '/postgres';
const sourceUrl = new URL(TEST_DATABASE_URL);
sourceUrl.pathname = `/${SOURCE_DB}`;

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const SQUAD = '33333333-3333-3333-3333-333333333333';

const runImport = () =>
  execFileSync('pnpm', ['exec', 'tsx', 'scripts/import-from-supabase.ts'], {
    env: { ...process.env, SUPABASE_DB_URL: sourceUrl.href, DATABASE_URL: TEST_DATABASE_URL },
    encoding: 'utf8',
  });

beforeAll(async () => {
  const admin = new pg.Client({ connectionString: adminUrl.href });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${SOURCE_DB} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${SOURCE_DB}`);
  await admin.end();

  const src = new pg.Client({ connectionString: sourceUrl.href });
  await src.connect();
  await src.query(`
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb, created_at timestamptz DEFAULT now());
    CREATE TABLE auth.identities (id uuid DEFAULT gen_random_uuid(), user_id uuid, provider text, provider_id text);
    CREATE TABLE public.profiles (id uuid PRIMARY KEY, display_name text, avatar_url text, step_goal int, updated_at timestamptz);
    CREATE TABLE public.squads (id uuid PRIMARY KEY, name text, description text, invite_code text, created_by uuid);
    CREATE TABLE public.squad_members (squad_id uuid, user_id uuid, role text, PRIMARY KEY (squad_id, user_id));
    CREATE TABLE public.daily_steps (user_id uuid, date date, steps int, PRIMARY KEY (user_id, date));

    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      ('${U1}', 'alice@example.com', '{"full_name":"Alice","avatar_url":"https://pic/alice"}'),
      ('${U2}', 'bob@example.com', '{"full_name":"Bob","picture":"https://pic/bob"}');
    INSERT INTO auth.identities (user_id, provider, provider_id) VALUES
      ('${U1}', 'google', 'google-sub-alice'), ('${U2}', 'email', 'ignored');
    INSERT INTO public.profiles VALUES ('${U1}', 'Alice A', NULL, 15000, now()), ('${U2}', NULL, 'https://dicebear/bob', NULL, now());
    INSERT INTO public.squads VALUES ('${SQUAD}', 'Walkers', NULL, 'ABC123', '${U1}');
    INSERT INTO public.squad_members VALUES ('${SQUAD}', '${U1}', 'admin'), ('${SQUAD}', '${U2}', NULL);
    INSERT INTO public.daily_steps VALUES ('${U1}', '2026-01-01', 1000), ('${U1}', '2026-01-02', 2000), ('${U2}', '2026-01-02', 500);
  `);
  await src.end();
  await setupDb();
});

afterAll(async () => {
  const admin = new pg.Client({ connectionString: adminUrl.href });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${SOURCE_DB} WITH (FORCE)`);
  await admin.end();
  await pool.end();
});

describe('import-from-supabase', () => {
  it('copies users, profiles, squads, members and steps, preserving ids', async () => {
    const out = runImport();
    expect(out).toContain('users: 2 read, 2 inserted');
    expect(out).toContain('daily_steps: 3 read, 3 inserted');

    expect(await query(`SELECT id, email, google_sub, full_name, avatar_url FROM users ORDER BY email`)).toEqual([
      { id: U1, email: 'alice@example.com', google_sub: 'google-sub-alice', full_name: 'Alice', avatar_url: 'https://pic/alice' },
      { id: U2, email: 'bob@example.com', google_sub: null, full_name: 'Bob', avatar_url: 'https://pic/bob' },
    ]);
    expect(await query(`SELECT id, display_name, step_goal FROM profiles ORDER BY step_goal DESC`)).toEqual([
      { id: U1, display_name: 'Alice A', step_goal: 15000 },
      { id: U2, display_name: null, step_goal: 10000 },
    ]);
    expect((await query(`SELECT description, invite_code FROM squads`))[0]).toEqual({ description: '', invite_code: 'ABC123' });
    expect(await query(`SELECT user_id, role FROM squad_members ORDER BY role`)).toEqual([
      { user_id: U1, role: 'admin' },
      { user_id: U2, role: 'member' },
    ]);
    expect(await query(`SELECT SUM(steps)::int AS total FROM daily_steps`)).toEqual([{ total: 3500 }]);
  });

  it('is idempotent', async () => {
    const out = runImport();
    expect(out).toContain('users: 2 read, 0 inserted');
    expect(await query(`SELECT 1 FROM users`)).toHaveLength(2);
    expect(await query(`SELECT 1 FROM daily_steps`)).toHaveLength(3);
  });

  it('imported data works through the API for a migrated user', async () => {
    const token = await signSession(config, U2);
    const res = await call(token, 'GET', `/squads/${SQUAD}/members?since=2026-01-01`);
    const members = (await res.json()) as any[];
    expect(res.status, JSON.stringify(members)).toBe(200);
    expect(members.map((m) => [m.user_id, m.total_steps])).toEqual([
      [U1, 3000],
      [U2, 500],
    ]);
    expect(await (await call(token, 'GET', '/squads')).json()).toMatchObject([{ id: SQUAD, name: 'Walkers' }]);
    expect(app).toBeDefined();
  });
});
