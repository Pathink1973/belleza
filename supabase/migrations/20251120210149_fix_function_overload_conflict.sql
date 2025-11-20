/*
  # Fix Function Overload Conflict

  ## Problem
  There are two versions of get_service_team_availability_matrix:
  - One with 2 parameters (uuid, date) - NEW with block_reason
  - One with 3 parameters (uuid, date, uuid) - OLD version
  
  PostgreSQL cannot decide which to use when called with 2 parameters,
  causing error: "Could not choose the best candidate function"

  ## Solution
  Drop the old 3-parameter version that is no longer used.
  The new 2-parameter version with block_reason will remain.

  ## Safety
  - The 3-parameter version is not used anywhere in the codebase
  - All calls use 2 parameters (p_service_id, p_date)
  - This change restores calendar functionality
*/

-- Drop the old 3-parameter version
DROP FUNCTION IF EXISTS public.get_service_team_availability_matrix(uuid, date, uuid);

-- Verify the 2-parameter version exists and has correct signature
-- (This is just a verification, the function already exists from previous migration)
DO $$
BEGIN
  -- Check if function exists with correct signature
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_service_team_availability_matrix'
      AND pg_get_function_arguments(p.oid) = 'p_service_id uuid, p_date date'
  ) THEN
    RAISE EXCEPTION 'Function get_service_team_availability_matrix(uuid, date) not found!';
  END IF;
END $$;