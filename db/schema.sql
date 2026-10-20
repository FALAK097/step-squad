-- Neon Schema with Row-Level Security (RLS) for Step Squad
-- Compatible with Neon Data API and Neon Auth (Managed Better Auth)

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id text PRIMARY KEY,
  display_name text,
  avatar_url text,
  step_goal integer DEFAULT 10000,
  updated_at timestamptz DEFAULT now()
);

-- 2. Squads Table
CREATE TABLE IF NOT EXISTS public.squads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  invite_code text UNIQUE NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. Squad Members Table
CREATE TABLE IF NOT EXISTS public.squad_members (
  squad_id uuid REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (squad_id, user_id)
);

-- 4. Daily Steps Table
CREATE TABLE IF NOT EXISTS public.daily_steps (
  user_id text NOT NULL,
  date date NOT NULL,
  steps integer NOT NULL CHECK (steps >= 0),
  PRIMARY KEY (user_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_squad_members_user_id ON public.squad_members(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_members_squad_id ON public.squad_members(squad_id);
CREATE INDEX IF NOT EXISTS idx_daily_steps_user_date ON public.daily_steps(user_id, date);
CREATE INDEX IF NOT EXISTS idx_squads_invite_code ON public.squads(invite_code);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_steps ENABLE ROW LEVEL SECURITY;

-- Fallback helper for auth.user_id() if not provided by the environment
CREATE OR REPLACE FUNCTION auth_user_id() RETURNS text AS $$
BEGIN
  BEGIN
    RETURN auth.user_id();
  EXCEPTION WHEN OTHERS THEN
    RETURN coalesce(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    );
  END;
END;
$$ LANGUAGE plpgsql STABLE;

-- Profiles Policies
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth_user_id() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth_user_id() = id);

-- Squads Policies
DROP POLICY IF EXISTS "Members and creators can view squads" ON public.squads;
CREATE POLICY "Members and creators can view squads"
  ON public.squads FOR SELECT
  USING (
    created_by = auth_user_id()
    OR EXISTS (
      SELECT 1 FROM public.squad_members
      WHERE squad_members.squad_id = squads.id
        AND squad_members.user_id = auth_user_id()
    )
    OR true -- Allowed to select by invite_code for joining
  );

DROP POLICY IF EXISTS "Users can create squads" ON public.squads;
CREATE POLICY "Users can create squads"
  ON public.squads FOR INSERT
  WITH CHECK (auth_user_id() = created_by);

DROP POLICY IF EXISTS "Creators can delete their squads" ON public.squads;
CREATE POLICY "Creators can delete their squads"
  ON public.squads FOR DELETE
  USING (auth_user_id() = created_by);

-- Squad Members Policies
DROP POLICY IF EXISTS "Users can view members of their squads" ON public.squad_members;
CREATE POLICY "Users can view members of their squads"
  ON public.squad_members FOR SELECT
  USING (
    user_id = auth_user_id()
    OR EXISTS (
      SELECT 1 FROM public.squad_members sm
      WHERE sm.squad_id = squad_members.squad_id
        AND sm.user_id = auth_user_id()
    )
  );

DROP POLICY IF EXISTS "Users can join squads" ON public.squad_members;
CREATE POLICY "Users can join squads"
  ON public.squad_members FOR INSERT
  WITH CHECK (auth_user_id() = user_id);

DROP POLICY IF EXISTS "Users can leave or creators remove members" ON public.squad_members;
CREATE POLICY "Users can leave or creators remove members"
  ON public.squad_members FOR DELETE
  USING (
    user_id = auth_user_id()
    OR EXISTS (
      SELECT 1 FROM public.squads
      WHERE squads.id = squad_members.squad_id
        AND squads.created_by = auth_user_id()
    )
  );

-- Daily Steps Policies
DROP POLICY IF EXISTS "Users and squad mates can view steps" ON public.daily_steps;
CREATE POLICY "Users and squad mates can view steps"
  ON public.daily_steps FOR SELECT
  USING (
    user_id = auth_user_id()
    OR EXISTS (
      SELECT 1 FROM public.squad_members sm1
      JOIN public.squad_members sm2 ON sm1.squad_id = sm2.squad_id
      WHERE sm1.user_id = auth_user_id()
        AND sm2.user_id = daily_steps.user_id
    )
  );

DROP POLICY IF EXISTS "Users can manage their own steps" ON public.daily_steps;
CREATE POLICY "Users can manage their own steps"
  ON public.daily_steps FOR ALL
  USING (user_id = auth_user_id())
  WITH CHECK (user_id = auth_user_id());
