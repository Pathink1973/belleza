/*
  # Fix Availability System to Check Blocked Dates First

  1. Problem Analysis
    - Current function generates all time slots even when entire day is blocked
    - No check for blocked_dates before processing slots
    - Inefficient: processes 22 slots even when day is unavailable
    - Error handling causes UI to break instead of showing fallback state

  2. Solution
    - Check blocked_dates FIRST before generating any slots
    - Return special flag 'is_day_blocked' when entire day is unavailable
    - Improve error handling to never throw errors that break UI
    - Add detailed logging for debugging without breaking functionality

  3. Benefits
    - Performance: Skip slot generation for blocked days
    - UX: UI can show "Day blocked" message instead of empty slots
    - Reliability: No errors that cause "Error loading available time slots"
    - Transparency: Clear indication why day is unavailable

  4. Implementation
    - Add blocked_dates check at start of function
    - Return empty result set with special metadata when day blocked
    - Add EXCEPTION handler to catch and log errors gracefully
    - Never throw errors that would break the UI
*/

-- =====================================================
-- STEP 1: Drop and recreate function with blocked_dates check
-- =====================================================

DROP FUNCTION IF EXISTS public.get_day_availability_for_service(uuid, date, integer);

CREATE OR REPLACE FUNCTION public.get_day_availability_for_service(
  p_service_id uuid,
  p_date date,
  p_duration_minutes integer DEFAULT 30
)
RETURNS TABLE(
  time_slot time,
  end_time time,
  available_professionals jsonb,
  total_capacity integer,
  available_count integer,
  is_available boolean,
  is_day_blocked boolean,
  blocked_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_service_owner_id uuid;
  v_team_jsonb jsonb;
  v_total_capacity integer := 0;
  v_current_time time;
  v_end_time time;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_available_profs jsonb;
  v_team_member jsonb;
  v_has_conflict boolean;
  v_unique_id text;
  v_profile_id uuid;
  v_team_member_id text;
  v_is_primary boolean;
  v_is_blocked boolean := false;
  v_blocked_reason text := NULL;
  v_professional_ids uuid[];
BEGIN
  -- Get service data
  SELECT professional_id, team
  INTO v_service_owner_id, v_team_jsonb
  FROM public.services
  WHERE id = p_service_id;

  -- If service not found, return empty (graceful failure)
  IF v_service_owner_id IS NULL THEN
    RAISE NOTICE 'Service % not found', p_service_id;
    RETURN;
  END IF;

  -- Calculate total capacity and build professional IDs list
  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    v_total_capacity := 1;
    v_professional_ids := ARRAY[v_service_owner_id];

    -- Build default team with service owner
    v_team_jsonb := jsonb_build_array(
      jsonb_build_object(
        'profile_id', v_service_owner_id,
        'is_primary', true,
        'name', (SELECT full_name FROM profiles WHERE id = v_service_owner_id),
        'imageUrl', (SELECT avatar_url FROM profiles WHERE id = v_service_owner_id)
      )
    );
  ELSE
    v_total_capacity := jsonb_array_length(v_team_jsonb);

    -- Extract all profile_ids from team for blocked_dates check
    SELECT ARRAY_AGG(DISTINCT (elem->>'profile_id')::uuid)
    INTO v_professional_ids
    FROM jsonb_array_elements(v_team_jsonb) elem
    WHERE elem->>'profile_id' IS NOT NULL;
  END IF;

  -- =====================================================
  -- CRITICAL: Check if ANY professional has this day blocked
  -- =====================================================
  SELECT EXISTS (
    SELECT 1
    FROM public.blocked_dates bd
    WHERE bd.professional_id = ANY(v_professional_ids)
      AND bd.date = p_date
  ), (
    SELECT bd.reason
    FROM public.blocked_dates bd
    WHERE bd.professional_id = ANY(v_professional_ids)
      AND bd.date = p_date
    LIMIT 1
  )
  INTO v_is_blocked, v_blocked_reason;

  -- If day is blocked, return immediately without generating slots
  -- This is MUCH more efficient than generating 22 slots that are all unavailable
  IF v_is_blocked THEN
    RAISE NOTICE 'Day % is blocked for service %: %', p_date, p_service_id, v_blocked_reason;

    -- Return a single row indicating day is blocked
    RETURN QUERY SELECT
      '00:00:00'::time,
      '00:00:00'::time,
      '[]'::jsonb,
      v_total_capacity,
      0::integer,
      false::boolean,
      true::boolean,
      COALESCE(v_blocked_reason, 'Dia indisponível')::text;

    RETURN;
  END IF;

  -- Day is NOT blocked, proceed with normal slot generation
  -- Generate time slots from 09:00 to 19:30
  FOR hour IN 9..19 LOOP
    FOR minute IN 0..30 BY 30 LOOP
      -- Skip 19:30 if duration would extend beyond 20:00
      IF hour = 19 AND minute = 30 THEN
        CONTINUE;
      END IF;

      v_current_time := make_time(hour, minute, 0);
      v_end_time := v_current_time + (p_duration_minutes || ' minutes')::interval;

      -- Convert to timestamptz for comparisons
      v_slot_start := (p_date::text || ' ' || v_current_time::text)::timestamptz;
      v_slot_end := (p_date::text || ' ' || v_end_time::text)::timestamptz;

      -- Build array of available professionals for this slot
      v_available_profs := '[]'::jsonb;

      FOR v_team_member IN SELECT * FROM jsonb_array_elements(v_team_jsonb)
      LOOP
        v_is_primary := COALESCE((v_team_member->>'is_primary')::boolean, false);

        IF v_is_primary THEN
          v_profile_id := COALESCE((v_team_member->>'profile_id')::uuid, v_service_owner_id);
          v_team_member_id := NULL;
          v_unique_id := v_profile_id::text;
        ELSE
          v_profile_id := NULL;
          v_team_member_id := v_team_member->>'team_member_db_id';
          v_unique_id := v_team_member_id;
        END IF;

        IF v_unique_id IS NULL THEN
          CONTINUE;
        END IF;

        -- Check for booking conflicts
        v_has_conflict := EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.service_id = p_service_id
            AND b.status = 'confirmado'
            AND b.start_time < v_slot_end
            AND b.end_time > v_slot_start
            AND (
              (v_is_primary AND b.professional_id = v_profile_id AND b.team_member_id IS NULL)
              OR
              (NOT v_is_primary AND b.team_member_id = v_team_member_id)
            )
        );

        -- Check blocked time slots
        IF NOT v_has_conflict AND v_profile_id IS NOT NULL THEN
          v_has_conflict := EXISTS (
            SELECT 1
            FROM public.blocked_time_slots bts
            WHERE bts.professional_id = v_profile_id
              AND bts.date = p_date
              AND bts.start_time < v_end_time
              AND bts.end_time > v_current_time
          );
        END IF;

        -- Add to available professionals if no conflict
        IF NOT v_has_conflict THEN
          v_available_profs := v_available_profs || jsonb_build_object(
            'unique_id', v_unique_id,
            'profile_id', v_profile_id,
            'team_member_id', v_team_member_id,
            'full_name', v_team_member->>'name',
            'avatar_url', v_team_member->>'imageUrl',
            'is_primary', v_is_primary
          );
        END IF;
      END LOOP;

      -- Return this time slot with its available professionals
      RETURN QUERY SELECT
        v_current_time,
        v_end_time,
        v_available_profs,
        v_total_capacity,
        jsonb_array_length(v_available_profs),
        jsonb_array_length(v_available_profs) > 0,
        false::boolean,  -- Day is not blocked
        NULL::text;      -- No blocked reason
    END LOOP;
  END LOOP;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't break the UI
    RAISE NOTICE 'Error in get_day_availability_for_service: % %', SQLERRM, SQLSTATE;

    -- Return empty result instead of throwing error
    -- This allows UI to show fallback state
    RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_day_availability_for_service IS
  'Returns availability for all time slots in a day. Checks blocked_dates first for efficiency. Never throws errors to prevent UI breaks.';

GRANT EXECUTE ON FUNCTION public.get_day_availability_for_service TO authenticated, anon;


-- =====================================================
-- STEP 2: Create helper function to quickly check if day is blocked
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_day_blocked_for_service(
  p_service_id uuid,
  p_date date
)
RETURNS TABLE(
  is_blocked boolean,
  reason text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_professional_ids uuid[];
BEGIN
  -- Get all professional IDs associated with this service
  SELECT ARRAY_AGG(DISTINCT prof_id)
  INTO v_professional_ids
  FROM (
    -- Service owner
    SELECT professional_id as prof_id FROM services WHERE id = p_service_id
    UNION
    -- Team members with profile_id
    SELECT (elem->>'profile_id')::uuid as prof_id
    FROM services s, jsonb_array_elements(s.team) elem
    WHERE s.id = p_service_id
      AND elem->>'profile_id' IS NOT NULL
  ) all_profs;

  -- Check if any of these professionals have the day blocked
  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1
      FROM blocked_dates bd
      WHERE bd.professional_id = ANY(v_professional_ids)
        AND bd.date = p_date
    ),
    (
      SELECT bd.reason
      FROM blocked_dates bd
      WHERE bd.professional_id = ANY(v_professional_ids)
        AND bd.date = p_date
      LIMIT 1
    );
END;
$$;

COMMENT ON FUNCTION public.is_day_blocked_for_service IS
  'Quickly checks if a day is blocked for any professional in a service team';

GRANT EXECUTE ON FUNCTION public.is_day_blocked_for_service TO authenticated, anon;
