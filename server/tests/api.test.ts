import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { call, createUser, pool, query, resetData, setupDb } from './helpers';

beforeAll(setupDb);
beforeEach(resetData);
afterAll(() => pool.end());

const json = async (res: Response) => res.json() as Promise<any>;

describe('profile', () => {
  it('returns defaults, then upserts only the provided fields', async () => {
    const u = await createUser('a@example.com', 'Alice');
    await query(`DELETE FROM profiles`);
    expect(await json(await call(u.token, 'GET', '/profile'))).toEqual({
      display_name: null,
      avatar_url: null,
      step_goal: 10000,
    });

    let res = await call(u.token, 'PUT', '/profile', { step_goal: 12000 });
    expect(await json(res)).toMatchObject({ step_goal: 12000, display_name: null });

    res = await call(u.token, 'PUT', '/profile', { display_name: 'Al', avatar_url: 'https://x.test/a.svg' });
    expect(await json(res)).toEqual({ display_name: 'Al', avatar_url: 'https://x.test/a.svg', step_goal: 12000 });
  });

  it('validates input', async () => {
    const u = await createUser('a@example.com');
    expect((await call(u.token, 'PUT', '/profile', { step_goal: 0 })).status).toBe(400);
    expect((await call(u.token, 'PUT', '/profile', { avatar_url: 'nope' })).status).toBe(400);
  });
});

describe('squads', () => {
  it('create -> join -> list -> members -> leave -> delete', async () => {
    const alice = await createUser('alice@example.com', 'Alice');
    const bob = await createUser('bob@example.com', 'Bob');

    const created = await call(alice.token, 'POST', '/squads', { name: 'Walkers', description: 'daily' });
    expect(created.status).toBe(201);
    const squad = await json(created);
    expect(squad).toMatchObject({ name: 'Walkers', created_by: alice.id });
    expect(squad.invite_code).toMatch(/^[A-Z0-9]{6}$/);

    // Alice is admin member
    expect((await query(`SELECT role FROM squad_members WHERE user_id = $1`, [alice.id]))[0].role).toBe('admin');

    // Bob joins (case-insensitive code), second join conflicts, bad code 404s
    const joined = await call(bob.token, 'POST', '/squads/join', { invite_code: squad.invite_code.toLowerCase() });
    expect(await json(joined)).toMatchObject({ squad_id: squad.id, squad: { name: 'Walkers' } });
    const again = await call(bob.token, 'POST', '/squads/join', { invite_code: squad.invite_code });
    expect(again.status).toBe(409);
    expect(await json(again)).toEqual({ error: 'You are already in this squad' });
    const bad = await call(bob.token, 'POST', '/squads/join', { invite_code: 'ZZZZZZ' });
    expect(bad.status).toBe(404);
    expect(await json(bad)).toEqual({ error: 'Invalid invite code' });

    expect(await json(await call(bob.token, 'GET', '/squads'))).toHaveLength(1);

    // Steps + ranked members
    await call(alice.token, 'PUT', '/steps', { days: [{ date: '2026-01-02', steps: 3000 }, { date: '2026-01-03', steps: 4000 }] });
    await call(bob.token, 'PUT', '/steps', { days: [{ date: '2026-01-03', steps: 9000 }] });
    let members = await json(await call(bob.token, 'GET', `/squads/${squad.id}/members?since=2026-01-01`));
    expect(members.map((m: any) => [m.display_name, m.role, m.total_steps])).toEqual([
      ['Bob', 'member', 9000],
      ['Alice', 'admin', 7000],
    ]);
    members = await json(await call(bob.token, 'GET', `/squads/${squad.id}/members?since=2026-01-03`));
    expect(members.map((m: any) => m.total_steps)).toEqual([9000, 4000]);

    // Non-members cannot read members
    const carol = await createUser('carol@example.com');
    expect((await call(carol.token, 'GET', `/squads/${squad.id}/members?since=2026-01-01`)).status).toBe(403);

    // Only the creator can delete
    expect((await call(bob.token, 'DELETE', `/squads/${squad.id}`)).status).toBe(404);
    expect((await call(bob.token, 'POST', `/squads/${squad.id}/leave`)).status).toBe(204);
    expect(await json(await call(bob.token, 'GET', '/squads'))).toHaveLength(0);
    expect((await call(alice.token, 'DELETE', `/squads/${squad.id}`)).status).toBe(204);
    expect(await query(`SELECT 1 FROM squads`)).toHaveLength(0);
    expect(await query(`SELECT 1 FROM squad_members`)).toHaveLength(0);
  });

  it('rejects malformed ids and bodies', async () => {
    const u = await createUser('a@example.com');
    expect((await call(u.token, 'DELETE', '/squads/not-a-uuid')).status).toBe(400);
    expect((await call(u.token, 'POST', '/squads', { name: '' })).status).toBe(400);
    expect((await call(u.token, 'POST', '/squads')).status).toBe(400);
  });
});

describe('steps', () => {
  it('upserts (last write wins, deduped) and reads ranges in order as date strings', async () => {
    const u = await createUser('a@example.com');
    let res = await call(u.token, 'PUT', '/steps', {
      days: [
        { date: '2026-02-01', steps: 100 },
        { date: '2026-02-02', steps: 200 },
        { date: '2026-02-01', steps: 150 },
      ],
    });
    expect(await json(res)).toEqual({ count: 2 });
    await call(u.token, 'PUT', '/steps', { days: [{ date: '2026-02-02', steps: 250 }] });
    await call(u.token, 'PUT', '/steps', { days: [] });

    res = await call(u.token, 'GET', '/steps?start=2026-02-01&end=2026-02-28');
    expect(await json(res)).toEqual([
      { date: '2026-02-01', steps: 150 },
      { date: '2026-02-02', steps: 250 },
    ]);
    expect(await json(await call(u.token, 'GET', '/steps?start=2026-02-02&end=2026-02-02'))).toHaveLength(1);
  });

  it("only returns the caller's steps, and validates input", async () => {
    const a = await createUser('a@example.com');
    const b = await createUser('b@example.com');
    await call(b.token, 'PUT', '/steps', { days: [{ date: '2026-02-01', steps: 5 }] });
    expect(await json(await call(a.token, 'GET', '/steps?start=2026-02-01&end=2026-02-01'))).toEqual([]);
    expect((await call(a.token, 'GET', '/steps?start=bad&end=2026-02-01')).status).toBe(400);
    expect((await call(a.token, 'PUT', '/steps', { days: [{ date: '2026-02-01', steps: -1 }] })).status).toBe(400);
  });
});

describe('leaderboard-status', () => {
  it('reports squads with others and whether the user leads in all of them', async () => {
    const a = await createUser('a@example.com');
    const b = await createUser('b@example.com');
    const status = async (u: { token: string }) =>
      json(await call(u.token, 'GET', '/leaderboard-status?date=2026-03-01'));

    expect(await status(a)).toEqual({ hasSquadWithOthers: false, isFirstPlace: false });

    const squad = await json(await call(a.token, 'POST', '/squads', { name: 'S' }));
    expect(await status(a)).toEqual({ hasSquadWithOthers: false, isFirstPlace: false }); // alone

    await call(b.token, 'POST', '/squads/join', { invite_code: squad.invite_code });
    await call(a.token, 'PUT', '/steps', { days: [{ date: '2026-03-01', steps: 100 }] });
    await call(b.token, 'PUT', '/steps', { days: [{ date: '2026-03-01', steps: 50 }] });
    expect(await status(a)).toEqual({ hasSquadWithOthers: true, isFirstPlace: true });
    expect(await status(b)).toEqual({ hasSquadWithOthers: true, isFirstPlace: false });
  });
});
