/*
  # Fix UUID vs TEXT Comparison in get_unified_slot_availability
  
  1. Problem
    - Error: "operator does not exist: uuid = text"
    - The function get_unified_slot_availability is comparing team_member_id (text) without proper null checks
    - This causes errors when validating booking capacity in Calendar.tsx
    
  2. Root Cause
    - Line 222: `b.team_member_id = v_team_member_id` without checking if both are NOT NULL
    - PostgreSQL can't compare when one might be uuid and another text
    
  3. Solution
    - Add explicit NULL checks in the comparison
    - Ensure we only compare when both values are NOT NULL
    - This matches the logic we used in other functions
*/

-- =====================================================
-- Fix get_unified_slot_availability function
-- =====================================================

DROP FUNCTION IF EXISTS public.get_unified_slot_availability(uuid, date, time, time);

CREATE OR REPLACE FUNCTION public.get_unified_slot_availability(
  p_service_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
RETURNS TABLE(
  is_available boolean,
  total_capacity integer,
  occupied_count integer,
  available_count integer,
  blocked_reason text,
  blocking_factor text,
  available_professionals jsonb,
  occupied_professionals jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_service_owner_id uuid;
  v_team_jsonb jsonb;
  v_total_capacity integer := 0;
  v_professional_ids uuid[];
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_is_day_blocked boolean := false;
  v_blocked_reason text := NULL;
  v_occupied_count integer := 0;
  v_available_profs jsonb := '[]'::jsonb;
  v_occupied_profs jsonb := '[]'::jsonb;
  v_team_member jsonb;
  v_is_primary boolean;
  v_profile_id uuid;
  v_team_member_id text;
  v_unique_id text;
  v_has_conflict boolean;
  v_full_name text;
  v_avatar_url text;
BEGIN
  SELECT professional_id, team
  INTO v_service_owner_id, v_team_jsonb
  FROM public.services
  WHERE id = p_service_id;

  IF v_service_owner_id IS NULL THEN
    RETURN QUERY SELECT
      false, 0, 0, 0,
      'Serviço não encontrado'::text,
      'service_not_found'::text,
      '[]'::jsonb, '[]'::jsonb;
    RETURN;
  END IF;

  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    v_total_capacity := 1;
    v_professional_ids := ARRAY[v_service_owner_id];

    SELECT full_name, avatar_url INTO v_full_name, v_avatar_url
    FROM profiles WHERE id = v_service_owner_id;

    v_team_jsonb := jsonb_build_array(
      jsonb_build_object(
        'profile_id', v_service_owner_id,
        'is_primary', true,
        'name', COALESCE(v_full_name, 'Profissional'),
        'imageUrl', v_avatar_url
      )
    );
  ELSE
    v_total_capacity := jsonb_array_length(v_team_jsonb);

    SELECT ARRAY_AGG(DISTINCT (elem->>'profile_id')::uuid)
    INTO v_professional_ids
    FROM jsonb_array_elements(v_team_jsonb) elem
    WHERE elem->>'profile_id' IS NOT NULL;
  END IF;

  v_slot_start := (p_date::text || ' ' || p_start_time::text)::timestamptz;
  v_slot_end := (p_date::text || ' ' || p_end_time::text)::timestamptz;

  -- Check blocked dates
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
  INTO v_is_day_blocked, v_blocked_reason;

  IF v_is_day_blocked THEN
    RETURN QUERY SELECT
      false,
      v_total_capacity,
      v_total_capacity,
      0,
      COALESCE(v_blocked_reason, 'Dia indisponível')::text,
      'day_blocked'::text,
      '[]'::jsonb,
      v_team_jsonb;
    RETURN;
  END IF;

  -- Process each professional
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

    -- CRITICAL FIX: Check for booking conflicts with proper NULL handling
    v_has_conflict := EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.service_id = p_service_id
        AND b.status = 'confirmado'
        AND b.start_time < v_slot_end
        AND b.end_time > v_slot_start
        AND (
          -- Match primary professional: uuid = uuid, team_member_id must be NULL
          (v_is_primary AND b.professional_id = v_profile_id AND b.team_member_id IS NULL)
          OR
          -- Match team member: text = text, both must be NOT NULL (FIXED)
          (NOT v_is_primary AND v_team_member_id IS NOT NULL AND b.team_member_id IS NOT NULL AND b.team_member_id = v_team_member_id)
        )
    );

    -- Check blocked time slots
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

    -- Add to appropriate list
    IF v_has_conflict THEN
      v_occupied_count := v_occupied_count + 1;
      v_occupied_profs := v_occupied_profs || jsonb_build_object(
        'unique_id', v_unique_id,
        'profile_id', v_profile_id,
        'team_member_id', v_team_member_id,
        'full_name', v_full_name,
        'avatar_url', v_avatar_url,
        'is_primary', v_is_primary
      );
    ELSE
      v_available_profs := v_available_profs || jsonb_build_object(
        'unique_id', v_unique_id,
        'profile_id', v_profile_id,
        'team_member_id', v_team_member_id,
        'full_name', v_full_name,
        'avatar_url', v_avatar_url,
        'is_primary', v_is_primary
      );
    END IF;
  END LOOP;

  -- Determine result
  IF v_occupied_count >= v_total_capacity THEN
    v_blocked_reason := format('Todos os %s profissionais estão ocupados neste horário', v_total_capacity);
    RETURN QUERY SELECT
      false,
      v_total_capacity,
      v_occupied_count,
      0,
      v_blocked_reason,
      'fully_booked'::text,
      '[]'::jsonb,
      v_occupied_profs;
  ELSE
    RETURN QUERY SELECT
      true,
      v_total_capacity,
      v_occupied_count,
      v_total_capacity - v_occupied_count,
      NULL::text,
      NULL::text,
      v_available_profs,
      v_occupied_profs;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_unified_slot_availability IS
  'Função unificada que verifica disponibilidade considerando TODO o ecossistema. Fixed uuid vs text comparison.';

GRANT EXECUTE ON FUNCTION public.get_unified_slot_availability TO authenticated, anon;
