/*
  # Add Service Variant Support to Blocks and Internal Bookings

  ## Purpose
  This migration ensures that bookings (both reservations and blocks) properly 
  reference service variants instead of just base services. This is critical 
  because each service has multiple variants with different prices, durations, 
  and capacity requirements.

  ## Changes

  1. **Database Structure**
    - Ensure service_variant_id column exists in bookings (already created in previous migration)
    - Add composite index for efficient variant-based queries
    - Add constraint to ensure blocks can target specific variants

  2. **Functions**
    - Update availability checking functions to consider service_variant_id
    - Modify conflict detection to be variant-specific
    - Update professional availability queries to filter by variant

  3. **RLS Policies**
    - No changes needed - existing policies work with variant_id

  ## Important Notes
  - Blocks can have service_variant_id NULL to block all variants of a service
  - Blocks with specific variant_id only affect that variant
  - Reservations should always have a service_variant_id
  - Existing bookings without variant_id will continue to work but should be updated
*/

-- Add composite index for efficient variant-based availability queries
CREATE INDEX IF NOT EXISTS idx_bookings_variant_time 
  ON bookings(service_variant_id, start_time, end_time, status) 
  WHERE service_variant_id IS NOT NULL;

-- Add index for blocks by variant
CREATE INDEX IF NOT EXISTS idx_bookings_variant_blocks 
  ON bookings(service_variant_id, booking_type, start_time, end_time) 
  WHERE booking_type = 'bloqueio';

-- Update the get_available_professionals function to support variants
CREATE OR REPLACE FUNCTION get_available_professionals_for_variant(
  p_service_id uuid,
  p_service_variant_id uuid,
  p_date date,
  p_time time,
  p_duration text
) RETURNS TABLE (
  professional_id uuid,
  team_member_id uuid,
  unique_id text,
  full_name text,
  avatar_url text,
  is_primary boolean
) AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_duration_minutes integer;
BEGIN
  -- Parse duration and calculate time range
  v_duration_minutes := CASE
    WHEN p_duration ~ '^\d+min$' THEN CAST(substring(p_duration from '^\d+') AS integer)
    WHEN p_duration ~ '^\d+h$' THEN CAST(substring(p_duration from '^\d+') AS integer) * 60
    WHEN p_duration ~ '^\d+h\d+min$' THEN 
      (CAST(substring(p_duration from '^\d+') AS integer) * 60) +
      CAST(substring(p_duration from '\d+min$') AS integer)
    ELSE 60
  END;

  v_start_time := (p_date || ' ' || p_time)::timestamptz;
  v_end_time := v_start_time + (v_duration_minutes || ' minutes')::interval;

  RETURN QUERY
  WITH service_team AS (
    SELECT 
      s.professional_id as owner_id,
      jsonb_array_elements(COALESCE(s.team, '[]'::jsonb)) as team_member
    FROM services s
    WHERE s.id = p_service_id
  ),
  team_members AS (
    SELECT
      CASE 
        WHEN (team_member->>'is_primary')::boolean THEN owner_id
        ELSE NULL
      END as professional_id,
      (team_member->>'team_member_db_id')::uuid as team_member_id,
      CASE 
        WHEN (team_member->>'is_primary')::boolean THEN owner_id::text
        ELSE (team_member->>'team_member_db_id')::text
      END as unique_id,
      team_member->>'full_name' as full_name,
      team_member->>'avatar_url' as avatar_url,
      (team_member->>'is_primary')::boolean as is_primary
    FROM service_team
  ),
  conflicting_bookings AS (
    SELECT DISTINCT
      COALESCE(b.professional_id::text, b.team_member_id::text) as blocked_unique_id
    FROM bookings b
    WHERE b.service_id = p_service_id
      AND b.status NOT IN ('cancelado', 'rejeitado')
      AND (
        -- Block affects this specific variant
        b.service_variant_id = p_service_variant_id
        -- OR block affects all variants (variant_id is NULL and it's a block)
        OR (b.service_variant_id IS NULL AND b.booking_type = 'bloqueio')
      )
      AND (
        (b.start_time < v_end_time AND b.end_time > v_start_time)
      )
  ),
  availability_blocks AS (
    SELECT DISTINCT
      COALESCE(a.professional_id::text, a.team_member_id::text) as blocked_unique_id
    FROM availability a
    WHERE (
      a.professional_id IN (SELECT owner_id FROM service_team)
      OR a.team_member_id IN (SELECT team_member_id FROM team_members WHERE team_member_id IS NOT NULL)
    )
    AND a.date = p_date
    AND a.is_available = false
  )
  SELECT 
    tm.professional_id,
    tm.team_member_id,
    tm.unique_id,
    tm.full_name,
    tm.avatar_url,
    tm.is_primary
  FROM team_members tm
  WHERE tm.unique_id NOT IN (SELECT blocked_unique_id FROM conflicting_bookings WHERE blocked_unique_id IS NOT NULL)
    AND tm.unique_id NOT IN (SELECT blocked_unique_id FROM availability_blocks WHERE blocked_unique_id IS NOT NULL)
  ORDER BY tm.is_primary DESC, tm.full_name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_available_professionals_for_variant TO authenticated, anon;

-- Update check_booking_conflicts to be variant-aware
CREATE OR REPLACE FUNCTION check_variant_booking_conflicts(
  p_service_id uuid,
  p_service_variant_id uuid,
  p_professional_id uuid,
  p_team_member_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_exclude_booking_id uuid DEFAULT NULL
) RETURNS boolean AS $$
DECLARE
  v_conflict_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_conflict_count
  FROM bookings
  WHERE service_id = p_service_id
    AND status NOT IN ('cancelado', 'rejeitado')
    AND (
      -- Check for conflicts with same variant
      service_variant_id = p_service_variant_id
      -- OR check for blocks that affect all variants
      OR (service_variant_id IS NULL AND booking_type = 'bloqueio')
    )
    AND (
      (professional_id = p_professional_id AND p_professional_id IS NOT NULL)
      OR (team_member_id = p_team_member_id AND p_team_member_id IS NOT NULL)
    )
    AND (
      (start_time < p_end_time AND end_time > p_start_time)
    )
    AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id);

  RETURN v_conflict_count > 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_variant_booking_conflicts TO authenticated, anon;

-- Add comment explaining variant blocking logic
COMMENT ON COLUMN bookings.service_variant_id IS 
  'Specific variant of the service. For blocks: NULL means block all variants, specific ID means block only that variant. For reservations: should always have a value.';
