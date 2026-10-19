/**
 * One-off data import: Supabase Postgres -> Neon.
 *
 *   SUPABASE_DB_URL=postgres://postgres:<pw>@db.<ref>.supabase.co:5432/postgres \
 *   DATABASE_URL=<neon connection string> \
 *   pnpm import:supabase
 *
 * - Run `pnpm migrate` against Neon first.
 * - Users keep their Supabase ids; their Google `sub` is taken from auth.identities, so existing
 *   users are recognised on their first sign-in against the new API.
 * - Idempotent: can be re-run, e.g. a final time right before cut-over. Existing rows are left
 *   untouched (ON CONFLICT DO NOTHING) except daily step counts, which a rerun refreshes with the
 *   latest Supabase values.
 * - All source reads happen in one REPEATABLE READ snapshot, so concurrently-created rows (e.g. a
 *   squad created after the users query) are visible consistently or not at all. For the final
 *   cut-over run, stop writes to Supabase so nothing is introduced between snapshot and restore.
 */
import pg from 'pg';

const BATCH = 1000;

const sourceUrl = process.env.SUPABASE_DB_URL;
const targetUrl = process.env.DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error('Set SUPABASE_DB_URL and DATABASE_URL');

const source = new pg.Client({ connectionString: sourceUrl });
const target = new pg.Client({ connectionString: targetUrl });

async function copy(
  name: string,
  select: string,
  insert: (recordset: string) => string
) {
  const { rows } = await source.query(select);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await target.query(insert('jsonb_to_recordset($1::jsonb)'), [
      JSON.stringify(rows.slice(i, i + BATCH)),
    ]);
    inserted += res.rowCount ?? 0;
  }
  console.log(`${name}: ${rows.length} read, ${inserted} inserted`);
}

async function main() {
  await source.connect();
  await target.connect();
  try {
    await Promise.all([
      // One consistent snapshot of all Supabase tables: rows created mid-import are either
      // fully visible or not at all, so foreign keys on the target never see half a dataset.
      source.query('BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY'),
      target.query('BEGIN'),
    ]);

    await copy(
      'users',
      `SELECT u.id::text AS id,
              u.email,
              (SELECT i.provider_id FROM auth.identities i
                WHERE i.user_id = u.id AND i.provider = 'google' LIMIT 1) AS google_sub,
              u.raw_user_meta_data->>'full_name' AS full_name,
              COALESCE(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') AS avatar_url,
              u.created_at
         FROM auth.users u`,
      (rs) => `INSERT INTO users (id, email, google_sub, full_name, avatar_url, created_at)
               SELECT id, email, google_sub, full_name, avatar_url, COALESCE(created_at, now())
                 FROM ${rs} AS t(id uuid, email text, google_sub text, full_name text, avatar_url text, created_at timestamptz)
               ON CONFLICT DO NOTHING`
    );

    await copy(
      'profiles',
      `SELECT id::text AS id, display_name, avatar_url, step_goal FROM public.profiles`,
      (rs) => `INSERT INTO profiles (id, display_name, avatar_url, step_goal)
               SELECT id, display_name, avatar_url, COALESCE(step_goal, 10000)
                 FROM ${rs} AS t(id uuid, display_name text, avatar_url text, step_goal int)
               ON CONFLICT DO NOTHING`
    );

    await copy(
      'squads',
      `SELECT id::text AS id, name, COALESCE(description, '') AS description, invite_code,
              created_by::text AS created_by,
              COALESCE(created_at, now()) AS created_at
         FROM public.squads`,
      (rs) => `INSERT INTO squads (id, name, description, invite_code, created_by, created_at)
               SELECT id, name, description, invite_code, created_by, created_at
                 FROM ${rs} AS t(id uuid, name text, description text, invite_code text, created_by uuid, created_at timestamptz)
               ON CONFLICT DO NOTHING`
    );

    await copy(
      'squad_members',
      `SELECT squad_id::text AS squad_id, user_id::text AS user_id, COALESCE(role, 'member') AS role,
              COALESCE(joined_at, now()) AS joined_at
         FROM public.squad_members`,
      (rs) => `INSERT INTO squad_members (squad_id, user_id, role, joined_at)
               SELECT squad_id, user_id, role, joined_at
                 FROM ${rs} AS t(squad_id uuid, user_id uuid, role text, joined_at timestamptz)
               ON CONFLICT DO NOTHING`
    );

    await copy(
      'daily_steps',
      `SELECT user_id::text AS user_id, date::text AS date, steps FROM public.daily_steps`,
      (rs) => `INSERT INTO daily_steps (user_id, date, steps)
               SELECT user_id, date, GREATEST(steps, 0)
                 FROM ${rs} AS t(user_id uuid, date date, steps int)
               ON CONFLICT (user_id, date) DO UPDATE SET steps = EXCLUDED.steps`
    );

    await Promise.all([source.query('COMMIT'), target.query('COMMIT')]);
    console.log('Import complete');
  } catch (err) {
    // COMMIT below only runs once one side has succeeded; ROLLBACK here covers both the
    // transaction case and a failure before any transaction was opened.
    const rollback = async (client: { query: (sql: string) => Promise<unknown> }) => {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Connection already gone / no open transaction.
      }
    };
    await Promise.all([rollback(source), rollback(target)]);
    throw err;
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
