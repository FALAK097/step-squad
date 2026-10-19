-- Step Squad schema for Neon (replaces Supabase auth.users + public tables).
-- Authorization that used to live in Supabase RLS policies is enforced in the API layer.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Replaces Supabase `auth.users`. Ids are preserved when importing existing users.
CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub  text UNIQUE,
  email       text UNIQUE,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id            uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  display_name  text,
  avatar_url    text,
  step_goal     integer NOT NULL DEFAULT 10000 CHECK (step_goal > 0),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE squads (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  description  text NOT NULL DEFAULT '',
  invite_code  text NOT NULL UNIQUE,
  created_by   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE squad_members (
  squad_id   uuid NOT NULL REFERENCES squads (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (squad_id, user_id)
);
CREATE INDEX squad_members_user_id_idx ON squad_members (user_id);

CREATE TABLE daily_steps (
  user_id  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date     date NOT NULL,
  steps    integer NOT NULL CHECK (steps >= 0),
  PRIMARY KEY (user_id, date)
);
