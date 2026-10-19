# Step Squad API (Neon)

Small [Hono](https://hono.dev) API that replaces the Supabase client-side data/auth layer. It talks to
[Neon](https://neon.tech) Postgres through `@neondatabase/serverless` and handles Google sign-in itself.

The mobile app never connects to the database directly: it calls this API with a session token.
Authorization that used to live in Supabase RLS policies is enforced in the route handlers
([`src/routes/api.ts`](src/routes/api.ts)).

## Setup

1. Create a Neon project and copy its (pooled) connection string.
2. `cp .env.example .env` and fill it in. Generate `SESSION_SECRET` with `openssl rand -base64 48`.
3. In the Google Cloud console, add `<PUBLIC_URL>/auth/google/callback` as an **Authorized redirect URI** of the
   existing web OAuth client (the one previously configured in Supabase), and use its id/secret as
   `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Create the schema:
   ```bash
   pnpm install
   export DATABASE_URL='postgresql://…neon.tech/neondb?sslmode=require'
   pnpm migrate
   ```
5. Run locally: `pnpm dev` (listens on `:8787`, loads env from your shell – e.g. `node --env-file=.env` or `export`).

## Migrating existing Supabase data

Do this once, before pointing production builds of the app at the new API.

1. Get the **direct** Postgres connection string of the Supabase project (Dashboard → Project Settings →
   Database → Connection string; use the "Session pooler"/direct string, not the transaction pooler).
2. Make sure the Neon schema exists (`pnpm migrate`).
3. Run:
   ```bash
   SUPABASE_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
   DATABASE_URL='postgresql://…neon.tech/neondb?sslmode=require' \
   pnpm import:supabase
   ```

What it does ([`scripts/import-from-supabase.ts`](scripts/import-from-supabase.ts)):

- Copies `auth.users` → `users` (keeping the **same user ids**, plus name/avatar from the Google metadata and
  the Google `sub` from `auth.identities`), then `profiles`, `squads`, `squad_members` and `daily_steps`.
- Runs in a single transaction (all or nothing) and is idempotent (`ON CONFLICT DO NOTHING`), so it can be
  re-run, e.g. a final time right before cut-over to pick up new step data.
- Users do **not** need to do anything special: on their first Google sign-in against the new API they are
  matched by Google `sub` (or verified email) to their imported account, so squads, history and goals carry over.
  They will be signed out once, because Supabase sessions are not valid against the new API.

Verify afterwards by comparing row counts (the script prints them) and signing in with a migrated account.

## Deploying (Vercel)

Import the repo in Vercel with **Root Directory = `server`** (the Hono framework preset is picked up from
[`vercel.json`](vercel.json)), and set the environment variables from `.env.example`
(`PUBLIC_URL` = the deployment URL). Then set `EXPO_PUBLIC_API_URL` in the app's `.env` / EAS environment to that URL.

## Tests

```bash
createdb stepsquad_test      # any local Postgres; override with TEST_DATABASE_URL
pnpm test
```

Tests run the real SQL against a local Postgres (including the Supabase import against a simulated Supabase
schema). They don't call Google or Neon.

## API

All routes except `/health` and `/auth/*` need `Authorization: Bearer <session token>`.

| Method & path | Purpose |
| --- | --- |
| `GET /auth/google/start?redirect_uri=` | Starts Google sign-in (opened in the in-app browser) |
| `GET /auth/google/callback` | Google redirect target; deep-links back to the app with `#access_token=` |
| `GET /me` | Current user |
| `GET/PUT /profile` | Display name, avatar, step goal |
| `GET/POST /squads`, `POST /squads/join`, `DELETE /squads/:id`, `POST /squads/:id/leave` | Squads |
| `GET /squads/:id/members?since=YYYY-MM-DD` | Members ranked by steps since a date (members only) |
| `GET /steps?start=&end=`, `PUT /steps` | Daily step history / sync |
| `GET /leaderboard-status?date=` | Used for notifications |
