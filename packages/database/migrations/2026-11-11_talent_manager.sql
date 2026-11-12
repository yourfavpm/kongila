-- Candidate ownership: which talent manager is responsible for whom.
--
-- This already existed, after a fashion. assignTalentManager wrote the id
-- into the bio column's JSON envelope, under telemetry.talentManagerId,
-- because talent_profiles had nowhere else to put it. That works for one
-- candidate at a time and fails at everything else: you cannot index it,
-- cannot filter on it in SQL, cannot join to it, and every read has to parse
-- a text column and hope it is the shape it expects. Scoping a whole portal
-- to "candidates this manager owns" on top of that would mean parsing every
-- row on every request.
--
-- The column is the real home. The envelope stays populated so nothing that
-- still reads it breaks, and this migration backfills from it so no existing
-- assignment is lost.
--
-- Safe to run more than once.

-- 1. The column.
ALTER TABLE public.talent_profiles
  ADD COLUMN IF NOT EXISTS talent_manager_id UUID NULL;

-- Deliberately ON DELETE SET NULL rather than CASCADE: an administrator
-- leaving should orphan their candidates for reassignment, never delete them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'talent_profiles_talent_manager_id_fkey'
      AND table_name = 'talent_profiles'
  ) THEN
    ALTER TABLE public.talent_profiles
      ADD CONSTRAINT talent_profiles_talent_manager_id_fkey
      FOREIGN KEY (talent_manager_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. The index. Every talent manager's dashboard filters on this column, so
-- it is the one lookup that happens on every request they make.
CREATE INDEX IF NOT EXISTS talent_profiles_talent_manager_id_idx
  ON public.talent_profiles (talent_manager_id)
  WHERE talent_manager_id IS NOT NULL;

-- 3. Backfill from the envelope, for assignments made before the column
--    existed. Only touches rows where the column is empty and the envelope
--    holds something that is both valid JSON and a real user id.
UPDATE public.talent_profiles AS t
SET talent_manager_id = (t.bio::jsonb -> 'telemetry' ->> 'talentManagerId')::uuid
WHERE t.talent_manager_id IS NULL
  AND t.bio IS NOT NULL
  AND t.bio <> ''
  -- jsonb_typeof on a non-JSON string raises, so check it parses first.
  AND (t.bio ~ '^\s*\{')
  AND (t.bio::jsonb -> 'telemetry' ->> 'talentManagerId') IS NOT NULL
  AND (t.bio::jsonb -> 'telemetry' ->> 'talentManagerId') ~ '^[0-9a-fA-F-]{36}$'
  AND EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (t.bio::jsonb -> 'telemetry' ->> 'talentManagerId')::uuid
  );

-- 4. What landed.
DO $$
DECLARE assigned INT; total INT;
BEGIN
  SELECT COUNT(*) INTO total FROM public.talent_profiles;
  SELECT COUNT(*) INTO assigned FROM public.talent_profiles WHERE talent_manager_id IS NOT NULL;
  RAISE NOTICE 'talent_manager_id: % of % candidates have an owner', assigned, total;
END $$;
