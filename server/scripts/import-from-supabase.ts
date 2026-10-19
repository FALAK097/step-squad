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
 * - Idempotent: existing rows in Neon are left untouched (ON CONFLICT DO NOTHING).
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
    await target.query('BEGIN');

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
              created_by::text AS created_by
         FROM public.squads`,
      (rs) => `INSERT INTO squads (id, name, description, invite_code, created_by)
               SELECT id, name, description, invite_code, created_by
                 FROM ${rs} AS t(id uuid, name text, description text, invite_code text, created_by uuid)
               ON CONFLICT DO NOTHING`
    );

    await copy(
      'squad_members',
      `SELECT squad_id::text AS squad_id, user_id::text AS user_id, COALESCE(role, 'member') AS role
         FROM public.squad_members`,
      (rs) => `INSERT INTO squad_members (squad_id, user_id, role)
               SELECT squad_id, user_id, role
                 FROM ${rs} AS t(squad_id uuid, user_id uuid, role text)
               ON CONFLICT DO NOTHING`
    );

    await copy(
      'daily_steps',
      `SELECT user_id::text AS user_id, date::text AS date, steps FROM public.daily_steps`,
      (rs) => `INSERT INTO daily_steps (user_id, date, steps)
               SELECT user_id, date, GREATEST(steps, 0)
                 FROM ${rs} AS t(user_id uuid, date date, steps int)
               ON CONFLICT DO NOTHING`
    );

    await target.query('COMMIT');
    console.log('Import complete');
  } catch (err) {
    await target.query('ROLLBACK');
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
