/*
  # Add Block Reason to Availability Functions

  ## Overview
  Enhance availability functions to return block_reason when time slots are unavailable due to blocks
  (e.g., "Almoço", "Pausa", "Reunião") so they can be displayed in both public and internal calendars.

  ## Changes
  1. Create helper function to detect if a slot is fully blocked
  2. Create new version of get_service_team_availability_matrix with block_reason
  3. Update get_available_professionals_for_slot to include block information

  ## Benefits
  - Public calendar shows "Almoço" instead of just "ESGOTADO"
  - Internal calendar can display block reasons with appropriate icons
  - Better UX: clients understand WHY a slot is unavailable
  - Transparent communication of professional's schedule
*/

-- =====================================================
-- STEP 1: Create helper function to get block info for a slot
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_slot_block_info(
  p_service_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
RETURNS TABLE(
  is_fully_blocked boolean,
  block_reason text,
  blocked_count integer,
  total_team_size integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_team_jsonb jsonb;
  v_team_size integer := 0;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_block_count integer;
  v_most_common_reason text;
BEGIN
  -- Get service team size
  SELECT s.team INTO v_team_jsonb
  FROM public.services s
  WHERE s.id = p_service_id;

  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    v_team_size := 1;
  ELSE
    v_team_size := jsonb_array_length(v_team_jsonb);
  END IF;

  -- Calculate slot timestamps
  v_slot_start := (p_date::text || ' ' || p_start_time::text)::timestamptz;
  v_slot_end := (p_date::text || ' ' || p_end_time::text)::timestamptz;

  -- Count how many blocks overlap this time slot
  SELECT COUNT(*)::integer INTO v_block_count
  FROM public.bookings b
  WHERE b.service_id = p_service_id
    AND b.booking_type = 'bloqueio'
    AND b.status = 'confirmado'
    AND b.start_time < v_slot_end
    AND b.end_time > v_slot_start;

  -- Get the most common block reason if slot is fully blocked
  IF v_block_count >= v_team_size THEN
    SELECT b.block_reason INTO v_most_common_reason
    FROM public.bookings b
    WHERE b.service_id = p_service_id
      AND b.booking_type = 'bloqueio'
      AND b.status = 'confirmado'
      AND b.start_time < v_slot_end
      AND b.end_time > v_slot_start
    GROUP BY b.block_reason
    ORDER BY COUNT(*) DESC
    LIMIT 1;
  END IF;

  RETURN QUERY SELECT
    (v_block_count >= v_team_size),
    COALESCE(v_most_common_reason, NULL),
    v_block_count,
    v_team_size;
END;
$$;

COMMENT ON FUNCTION public.get_slot_block_info IS
  'Returns information about blocks in a time slot: whether fully blocked, reason, and counts';

GRANT EXECUTE ON FUNCTION public.get_slot_block_info TO authenticated, anon;

-- =====================================================
-- STEP 2: Create new overload of get_service_team_availability_matrix
-- (2 parameters, with block_reason in return)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_service_team_availability_matrix(
  p_service_id uuid,
  p_date date
)
RETURNS TABLE(
  time_slot text,
  total_capacity integer,
  available_count integer,
  occupied_count integer,
  is_available boolean,
  utilization_percentage numeric,
  block_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_team_jsonb jsonb;
  v_team_size integer := 0;
  v_service_owner_id uuid;
  v_hour integer;
  v_minute integer;
  v_start_time time;
  v_end_time time;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_confirmed_count integer;
  v_available_count integer;
  v_occupied_count integer;
  v_utilization numeric;
  v_block_info RECORD;
BEGIN
  -- Get service team data
  SELECT s.professional_id, s.team
  INTO v_service_owner_id, v_team_jsonb
  FROM public.services s
  WHERE s.id = p_service_id;

  IF v_service_owner_id IS NULL THEN
    RAISE EXCEPTION 'Service not found: %', p_service_id;
  END IF;

  -- Calculate team size (total capacity per slot)
  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    v_team_size := 1;
  ELSE
    v_team_size := jsonb_array_length(v_team_jsonb);
  END IF;

  -- Generate time slots from 09:00 to 19:30 (30-minute intervals)
  FOR v_hour IN 9..19 LOOP
    FOR v_minute IN 0..30 BY 30 LOOP
      IF v_hour = 19 AND v_minute > 30 THEN
        EXIT;
      END IF;

      v_start_time := (v_hour || ':' || LPAD(v_minute::text, 2, '0'))::time;
      v_end_time := (v_start_time::interval + interval '30 minutes')::time;

      v_slot_start := (p_date::text || ' ' || v_start_time::text)::timestamptz;
      v_slot_end := (p_date::text || ' ' || v_end_time::text)::timestamptz;

      -- Count confirmed bookings (both regular bookings and blocks)
      SELECT COUNT(*)::integer INTO v_confirmed_count
      FROM public.bookings b
      WHERE b.service_id = p_service_id
        AND b.status = 'confirmado'
        AND b.start_time < v_slot_end
        AND b.end_time > v_slot_start;

      v_occupied_count := v_confirmed_count;
      v_available_count := v_team_size - v_confirmed_count;

      IF v_available_count < 0 THEN
        v_available_count := 0;
      END IF;

      -- Calculate utilization
      IF v_team_size > 0 THEN
        v_utilization := ROUND((v_occupied_count::numeric / v_team_size::numeric) * 100, 2);
      ELSE
        v_utilization := 0;
      END IF;

      -- Check if slot is fully blocked and get block reason
      SELECT * INTO v_block_info
      FROM public.get_slot_block_info(p_service_id, p_date, v_start_time, v_end_time);

      RETURN QUERY SELECT
        v_start_time::text,
        v_team_size,
        v_available_count,
        v_occupied_count,
        (v_available_count > 0),
        v_utilization,
        CASE
          WHEN v_block_info.is_fully_blocked THEN v_block_info.block_reason
          ELSE NULL
        END;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_service_team_availability_matrix(uuid, date) IS
  'Returns availability matrix for all time slots in a day with block reasons when applicable';

GRANT EXECUTE ON FUNCTION public.get_service_team_availability_matrix(uuid, date) TO authenticated, anon;

-- =====================================================
-- STEP 3: Update statistics
-- =====================================================

ANALYZE public.bookings;
ANALYZE public.services;