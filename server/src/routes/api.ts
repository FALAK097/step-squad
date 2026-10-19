import { randomInt } from 'node:crypto';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Config } from '../config';
import { isUniqueViolation, type Query } from '../db';
import { requireAuth, type AppEnv } from '../session';

const DEFAULT_STEP_GOAL = 10000;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const uuid = z.guid(); // lenient 8-4-4-4-12 hex, same as what Postgres accepts for uuid
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((val) => {
    const d = new Date(val + 'T00:00:00Z');
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === val;
  }, { message: 'Invalid calendar date' });

const profileBody = z
  .object({
    display_name: z.string().trim().min(1).max(50),
    avatar_url: z.string().url().max(500),
    step_goal: z.number().int().min(1).max(1_000_000),
  })
  .partial();

const squadBody = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).default(''),
});

const joinBody = z.object({ invite_code: z.string().trim().min(1).max(20) });

const stepsBody = z.object({
  days: z
    .array(z.object({ date: dateStr, steps: z.number().int().min(0).max(1_000_000) }))
    .max(366),
});

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HTTPException(400, { message: result.error.issues.map((i) => i.message).join('; ') });
  }
  return result.data;
}

const generateInviteCode = () =>
  Array.from({ length: 6 }, () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]).join('');

const SQUAD_COLUMNS = 's.id, s.name, s.description, s.invite_code, s.created_by';

export function apiRoutes(deps: { config: Config; query: Query }) {
  const { config, query } = deps;
  const app = new Hono<AppEnv>();
  app.use('*', requireAuth(config));

  async function assertMember(squadId: string, userId: string) {
    const rows = await query(`SELECT 1 FROM squad_members WHERE squad_id = $1 AND user_id = $2`, [
      squadId,
      userId,
    ]);
    if (rows.length === 0) throw new HTTPException(403, { message: 'Not a member of this squad' });
  }

  // --- Current user -------------------------------------------------------

  app.get('/me', async (c) => {
    const [user] = await query(
      `SELECT id, email, full_name, avatar_url FROM users WHERE id = $1`,
      [c.get('userId')]
    );
    if (!user) throw new HTTPException(401, { message: 'Unknown user' });
    return c.json(user);
  });

  app.get('/profile', async (c) => {
    const [profile] = await query(
      `SELECT display_name, avatar_url, step_goal FROM profiles WHERE id = $1`,
      [c.get('userId')]
    );
    return c.json(profile ?? { display_name: null, avatar_url: null, step_goal: DEFAULT_STEP_GOAL });
  });

  app.put('/profile', async (c) => {
    const body = parse(profileBody, await c.req.json().catch(() => null));
    const columns = Object.keys(body) as (keyof typeof body)[]; // whitelisted by the schema
    const values = columns.map((k) => body[k]);

    const insertCols = ['id', ...columns, 'updated_at'];
    const placeholders = ['$1', ...columns.map((_, i) => `$${i + 2}`), 'now()'];
    const updates = [...columns.map((k) => `${k} = EXCLUDED.${k}`), 'updated_at = now()'];

    const [profile] = await query(
      `INSERT INTO profiles (${insertCols.join(', ')}) VALUES (${placeholders.join(', ')})
       ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}
       RETURNING display_name, avatar_url, step_goal`,
      [c.get('userId'), ...values]
    );
    return c.json(profile);
  });

  // --- Squads -------------------------------------------------------------

  app.get('/squads', async (c) => {
    const rows = await query(
      `SELECT ${SQUAD_COLUMNS}
         FROM squads s JOIN squad_members m ON m.squad_id = s.id
        WHERE m.user_id = $1
        ORDER BY m.joined_at DESC, s.name ASC`,
      [c.get('userId')]
    );
    return c.json(rows);
  });

  app.post('/squads', async (c) => {
    const { name, description } = parse(squadBody, await c.req.json().catch(() => null));
    const userId = c.get('userId');

    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [squad] = await query(
          `WITH s AS (
             INSERT INTO squads (name, description, invite_code, created_by)
             VALUES ($1, $2, $3, $4) RETURNING *
           ), m AS (
             INSERT INTO squad_members (squad_id, user_id, role)
             SELECT id, $4, 'admin' FROM s
           )
           SELECT ${SQUAD_COLUMNS} FROM s`,
          [name, description, generateInviteCode(), userId]
        );
        return c.json(squad, 201);
      } catch (err) {
        if (!isUniqueViolation(err)) throw err; // invite code collision -> retry
      }
    }
    throw new HTTPException(500, { message: 'Could not generate an invite code' });
  });

  app.post('/squads/join', async (c) => {
    const { invite_code } = parse(joinBody, await c.req.json().catch(() => null));
    const [row] = await query<{ squad: any; joined: boolean }>(
      `WITH s AS (
         SELECT ${SQUAD_COLUMNS} FROM squads s WHERE s.invite_code = $1
       ), ins AS (
         INSERT INTO squad_members (squad_id, user_id) SELECT id, $2 FROM s
         ON CONFLICT DO NOTHING RETURNING squad_id
       )
       SELECT (SELECT row_to_json(s) FROM s) AS squad, EXISTS (SELECT 1 FROM ins) AS joined`,
      [invite_code.toUpperCase(), c.get('userId')]
    );
    if (!row.squad) throw new HTTPException(404, { message: 'Invalid invite code' });
    if (!row.joined) throw new HTTPException(409, { message: 'You are already in this squad' });
    return c.json({ squad_id: row.squad.id, squad: row.squad });
  });

  app.delete('/squads/:id', async (c) => {
    const id = parse(uuid, c.req.param('id'));
    const rows = await query(`DELETE FROM squads WHERE id = $1 AND created_by = $2 RETURNING id`, [
      id,
      c.get('userId'),
    ]);
    if (rows.length === 0) {
      throw new HTTPException(404, { message: 'Squad not found or you are not its creator' });
    }
    return c.body(null, 204);
  });

  app.post('/squads/:id/leave', async (c) => {
    const id = parse(uuid, c.req.param('id'));
    await query(`DELETE FROM squad_members WHERE squad_id = $1 AND user_id = $2`, [
      id,
      c.get('userId'),
    ]);
    return c.body(null, 204);
  });

  /** Members ranked by total steps since `since` (inclusive). */
  app.get('/squads/:id/members', async (c) => {
    const id = parse(uuid, c.req.param('id'));
    const since = parse(dateStr, c.req.query('since'));
    await assertMember(id, c.get('userId'));

    const rows = await query(
      `SELECT m.user_id,
              m.role,
              COALESCE(NULLIF(p.display_name, ''), 'Anonymous') AS display_name,
              p.avatar_url,
              COALESCE((SELECT SUM(d.steps) FROM daily_steps d
                         WHERE d.user_id = m.user_id AND d.date >= $2::date), 0)::int AS total_steps
         FROM squad_members m LEFT JOIN profiles p ON p.id = m.user_id
        WHERE m.squad_id = $1
        ORDER BY total_steps DESC, m.joined_at`,
      [id, since]
    );
    return c.json(rows);
  });

  // --- Steps --------------------------------------------------------------

  app.get('/steps', async (c) => {
    const start = parse(dateStr, c.req.query('start'));
    const end = parse(dateStr, c.req.query('end'));
    const rows = await query(
      `SELECT date::text AS date, steps FROM daily_steps
        WHERE user_id = $1 AND date >= $2::date AND date <= $3::date
        ORDER BY date`,
      [c.get('userId'), start, end]
    );
    return c.json(rows);
  });

  app.put('/steps', async (c) => {
    const { days } = parse(stepsBody, await c.req.json().catch(() => null));
    const byDate = new Map(days.map((d) => [d.date, d.steps])); // last write wins per date
    if (byDate.size > 0) {
      await query(
        `INSERT INTO daily_steps (user_id, date, steps)
         SELECT $1, t.d, t.s FROM unnest($2::date[], $3::int[]) AS t(d, s)
         ON CONFLICT (user_id, date) DO UPDATE SET steps = EXCLUDED.steps`,
        [c.get('userId'), [...byDate.keys()], [...byDate.values()]]
      );
    }
    return c.json({ count: byDate.size });
  });

  /**
   * Used for notifications: does the user share a squad with others, and are they
   * leading (or tied for the lead) in all of those squads on `date`?
   */
  app.get('/leaderboard-status', async (c) => {
    const date = parse(dateStr, c.req.query('date'));
    const userId = c.get('userId');
    const rows = await query<{ squad_id: string; user_id: string; steps: number }>(
      `SELECT m.squad_id, m.user_id, COALESCE(SUM(d.steps), 0)::int AS steps
         FROM squad_members m
         LEFT JOIN daily_steps d ON d.user_id = m.user_id AND d.date = $2::date
        WHERE m.squad_id IN (SELECT squad_id FROM squad_members WHERE user_id = $1)
        GROUP BY m.squad_id, m.user_id`,
      [userId, date]
    );

    const squads = new Map<string, { user_id: string; steps: number }[]>();
    for (const r of rows) squads.set(r.squad_id, [...(squads.get(r.squad_id) ?? []), r]);

    let hasSquadWithOthers = false;
    let leadsEverywhere = true;
    for (const members of squads.values()) {
      if (members.length <= 1) continue;
      hasSquadWithOthers = true;
      const mine = members.find((m) => m.user_id === userId)?.steps ?? 0;
      if (members.some((m) => m.steps > mine)) leadsEverywhere = false;
    }
    return c.json({ hasSquadWithOthers, isFirstPlace: hasSquadWithOthers && leadsEverywhere });
  });

  return app;
}
