/**
 * One-way snapshot import from Supabase Postgres into Neon Postgres.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgres://..." DATABASE_URL="postgres://..." pnpm tsx scripts/import-from-supabase.ts
 */
import pg from 'pg';

const envSupabaseUrl = process.env.SUPABASE_DB_URL;
const envDatabaseUrl = process.env.DATABASE_URL;
if (!envSupabaseUrl || !envDatabaseUrl) {
  console.error('Error: both SUPABASE_DB_URL and DATABASE_URL must be set in the environment');
  process.exit(1);
}
const supabaseUrl: string = envSupabaseUrl;
const databaseUrl: string = envDatabaseUrl;

async function run() {
  const srcIsLocal = supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1');
  const dstIsLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const srcCa = process.env.SUPABASE_DB_CA;
  const dstCa = process.env.DATABASE_CA;
  const srcSsl = srcIsLocal ? false : srcCa ? { ca: srcCa, rejectUnauthorized: true } : { rejectUnauthorized: false };
  const dstSsl = dstIsLocal ? false : dstCa ? { ca: dstCa, rejectUnauthorized: true } : { rejectUnauthorized: false };

  const src = new pg.Client({ connectionString: supabaseUrl, ssl: srcSsl });
  const dst = new pg.Client({ connectionString: databaseUrl, ssl: dstSsl });

  await src.connect();
  await dst.connect();

  console.log('Connected to source and destination databases.');

  try {
    await src.query('BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await dst.query('BEGIN');

    // 0. Auth Users & OAuth Identities -> neon_auth.user & neon_auth.account
    const { rows: authUsers } = await src.query(`
      SELECT
        id,
        email,
        coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)) AS name,
        coalesce(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture') AS image,
        (email_confirmed_at IS NOT NULL) AS email_verified,
        created_at,
        updated_at
      FROM auth.users
    `);
    console.log(`auth.users: ${authUsers.length} read from Supabase`);
    for (const u of authUsers) {
      await dst.query(`
        INSERT INTO neon_auth."user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, coalesce($6, now()), coalesce($7, now()))
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          "emailVerified" = EXCLUDED."emailVerified",
          image = EXCLUDED.image,
          "updatedAt" = EXCLUDED."updatedAt"
      `, [u.id, u.name, u.email, u.email_verified, u.image, u.created_at, u.updated_at]);
    }

    const { rows: authIdentities } = await src.query(`
      SELECT id, provider_id, provider, user_id, created_at, updated_at
      FROM auth.identities
    `);
    console.log(`auth.identities: ${authIdentities.length} read from Supabase`);
    for (const ident of authIdentities) {
      await dst.query(`
        INSERT INTO neon_auth.account (id, "accountId", "providerId", "userId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, coalesce($5, now()), coalesce($6, now()))
        ON CONFLICT (id) DO UPDATE SET
          "accountId" = EXCLUDED."accountId",
          "providerId" = EXCLUDED."providerId",
          "userId" = EXCLUDED."userId",
          "updatedAt" = EXCLUDED."updatedAt"
      `, [ident.id, ident.provider_id, ident.provider, ident.user_id, ident.created_at, ident.updated_at]);
    }

    // 1. Profiles
    const { rows: profiles } = await src.query(`
      SELECT id::text, coalesce(display_name, full_name) AS display_name, avatar_url, step_goal, coalesce(updated_at, now()) AS updated_at
      FROM public.profiles
    `);
    console.log(`profiles: ${profiles.length} read from Supabase`);
    for (const p of profiles) {
      await dst.query(`
        INSERT INTO public.profiles (id, display_name, avatar_url, step_goal, updated_at)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          avatar_url = EXCLUDED.avatar_url,
          step_goal = EXCLUDED.step_goal,
          updated_at = EXCLUDED.updated_at
      `, [p.id, p.display_name, p.avatar_url, p.step_goal, p.updated_at]);
    }

    // 2. Squads
    const { rows: squads } = await src.query(`
      SELECT id, name, coalesce(description, '') as description, invite_code, created_by::text, created_at
      FROM public.squads
    `);
    console.log(`squads: ${squads.length} read from Supabase`);
    for (const s of squads) {
      await dst.query(`
        INSERT INTO public.squads (id, name, description, invite_code, created_by, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          invite_code = EXCLUDED.invite_code,
          created_by = EXCLUDED.created_by,
          created_at = EXCLUDED.created_at
      `, [s.id, s.name, s.description, s.invite_code, s.created_by, s.created_at]);
    }

    // 3. Squad members
    const { rows: members } = await src.query(`
      SELECT squad_id, user_id::text, coalesce(role, 'member') as role, created_at as joined_at
      FROM public.squad_members
    `);
    console.log(`squad_members: ${members.length} read from Supabase`);
    for (const m of members) {
      await dst.query(`
        INSERT INTO public.squad_members (squad_id, user_id, role, joined_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (squad_id, user_id) DO UPDATE SET
          role = EXCLUDED.role,
          joined_at = EXCLUDED.joined_at
      `, [m.squad_id, m.user_id, m.role, m.joined_at]);
    }

    // 4. Daily steps
    const { rows: steps } = await src.query(`
      SELECT user_id::text, date::text as date, steps
      FROM public.daily_steps
    `);
    console.log(`daily_steps: ${steps.length} read from Supabase`);
    for (const st of steps) {
      await dst.query(`
        INSERT INTO public.daily_steps (user_id, date, steps)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, date) DO UPDATE SET steps = EXCLUDED.steps
      `, [st.user_id, st.date, st.steps]);
    }

    await dst.query('COMMIT');
    await src.query('COMMIT');
    console.log('✅ Import completed successfully.');
  } catch (err) {
    await dst.query('ROLLBACK').catch(() => {});
    await src.query('ROLLBACK').catch(() => {});
    console.error('❌ Import failed and was rolled back:', err);
    process.exit(1);
  } finally {
    await src.end();
    await dst.end();
  }
}

run();
