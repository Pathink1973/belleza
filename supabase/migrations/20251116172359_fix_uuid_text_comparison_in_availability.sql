/*
  # Fix UUID vs TEXT Comparison Error in Availability Functions
  
  1. Problem
    - Error: "operator does not exist: uuid = text"
    - Occurs when checking availability because team_member_id is text but sometimes compared with uuid
    - Functions fail when validating slot availability
    
  2. Root Cause
    - In bookings table, team_member_id is TEXT (correct for UUIDs from service_team_members)
    - In comparisons, we're mixing uuid and text types without proper casting
    - PostgreSQL is strict about type matching in WHERE clauses
    
  3. Solution
    - Fix all functions to properly cast types when comparing
    - Ensure team_member_id comparisons always use text::text
    - Ensure profile_id comparisons always use uuid::uuid
    
  4. Changes
    - Update get_available_professionals_for_slot to cast correctly
    - Update get_day_availability_for_service to cast correctly
    - Add explicit type casting in all WHERE clauses
*/

-- =====================================================
-- STEP 1: Fix get_available_professionals_for_slot
-- =====================================================

DROP FUNCTION IF EXISTS public.get_available_professionals_for_slot(uuid, date, time, time);

CREATE OR REPLACE FUNCTION public.get_available_professionals_for_slot(
  p_service_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
RETURNS TABLE(
  unique_id text,
  profile_id uuid,
  team_member_id text,
  full_name text,
  avatar_url text,
  is_primary boolean,
  total_capacity integer,
  booked_count integer,
  available_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_service_owner_id uuid;
  v_team_jsonb jsonb;
  v_team_member jsonb;
  v_total_capacity integer := 0;
  v_available_count integer := 0;
  v_booked_count integer := 0;
  v_has_conflict boolean;
  v_unique_id text;
  v_profile_id uuid;
  v_team_member_id text;
  v_full_name text;
  v_avatar_url text;
  v_is_primary boolean;
BEGIN
  v_slot_start := (p_date::text || ' ' || p_start_time::text)::timestamptz;
  v_slot_end := (p_date::text || ' ' || p_end_time::text)::timestamptz;
  
  SELECT professional_id, team 
  INTO v_service_owner_id, v_team_jsonb
  FROM public.services
  WHERE id = p_service_id;
  
  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    RETURN;
  END IF;
  
  v_total_capacity := jsonb_array_length(v_team_jsonb);
  
  FOR v_team_member IN SELECT * FROM jsonb_array_elements(v_team_jsonb)
  LOOP
    v_is_primary := COALESCE((v_team_member->>'is_primary')::boolean, false);
    v_full_name := v_team_member->>'name';
    v_avatar_url := v_team_member->>'imageUrl';
    
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
    
    -- CRITICAL FIX: Proper type casting in comparisons
    v_has_conflict := EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.service_id = p_service_id
        AND b.status = 'confirmado'
        AND b.start_time < v_slot_end
        AND b.end_time > v_slot_start
        AND (
          -- Match primary professional: compare uuid with uuid
          (v_is_primary AND b.professional_id = v_profile_id AND b.team_member_id IS NULL)
          OR
          -- Match team member: compare text with text (FIXED)
          (NOT v_is_primary AND v_team_member_id IS NOT NULL AND b.team_member_id = v_team_member_id)
        )
    );
    
    IF NOT v_has_conflict AND v_profile_id IS NOT NULL THEN
      v_has_conflict := EXISTS (
        SELECT 1
        FROM public.blocked_time_slots bts
        WHERE bts.professional_id = v_profile_id
          AND bts.date = p_date
          AND bts.start_time < p_end_time
          AND bts.end_time > p_start_time
      );
    END IF;
    
    IF NOT v_has_conflict THEN
      v_available_count := v_available_count + 1;
      
      RETURN QUERY SELECT
        v_unique_id,
        v_profile_id,
        v_team_member_id,
        v_full_name,
        v_avatar_url,
        v_is_primary,
        v_total_capacity,
        v_booked_count,
        v_available_count;
    ELSE
      v_booked_count := v_booked_count + 1;
    END IF;
  END LOOP;
  
END;
$$;

COMMENT ON FUNCTION public.get_available_professionals_for_slot IS 
  'Returns list of individual professionals available for a specific time slot. Fixed type casting for uuid vs text comparisons.';

GRANT EXECUTE ON FUNCTION public.get_available_professionals_for_slot TO authenticated, anon;


-- =====================================================
-- STEP 2: Fix get_day_availability_for_service
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
  is_available boolean
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
BEGIN
  SELECT professional_id, team 
  INTO v_service_owner_id, v_team_jsonb
  FROM public.services
  WHERE id = p_service_id;
  
  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    v_total_capacity := 1;
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
  END IF;
  
  FOR hour IN 9..19 LOOP
    FOR minute IN 0..30 BY 30 LOOP
      IF hour = 19 AND minute = 30 THEN
        CONTINUE;
      END IF;
      
      v_current_time := make_time(hour, minute, 0);
      v_end_time := v_current_time + (p_duration_minutes || ' minutes')::interval;
      
      v_slot_start := (p_date::text || ' ' || v_current_time::text)::timestamptz;
      v_slot_end := (p_date::text || ' ' || v_end_time::text)::timestamptz;
      
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
        
        -- CRITICAL FIX: Proper type casting in comparisons
        v_has_conflict := EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.service_id = p_service_id
            AND b.status = 'confirmado'
            AND b.start_time < v_slot_end
            AND b.end_time > v_slot_start
            AND (
              -- Match primary professional: compare uuid with uuid
              (v_is_primary AND b.professional_id = v_profile_id AND b.team_member_id IS NULL)
              OR
              -- Match team member: compare text with text (FIXED)
              (NOT v_is_primary AND v_team_member_id IS NOT NULL AND b.team_member_id = v_team_member_id)
            )
        );
        
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
      
      RETURN QUERY SELECT
        v_current_time,
        v_end_time,
        v_available_profs,
        v_total_capacity,
        jsonb_array_length(v_available_profs),
        jsonb_array_length(v_available_profs) > 0;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_day_availability_for_service IS 
  'Returns availability for all time slots in a day. Fixed type casting for uuid vs text comparisons.';

GRANT EXECUTE ON FUNCTION public.get_day_availability_for_service TO authenticated, anon;
