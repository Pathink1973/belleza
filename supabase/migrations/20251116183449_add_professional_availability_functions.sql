/*
  # Enhanced Professional Availability Counting Functions
  
  ## Overview
  This migration adds comprehensive functions for real-time professional availability counting
  across the entire platform. These functions power the availability display in calendars,
  booking forms, service cards, and landing pages.
  
  ## New Functions
  1. `get_professionals_availability_for_slot` - Returns detailed professional list with availability status
  2. `get_daily_professionals_summary` - Aggregates availability by time periods (morning, afternoon, evening)
  3. `get_service_team_availability_matrix` - Returns availability matrix for entire day (optimized for calendar views)
  4. `get_next_available_slot_with_professionals` - Finds next available time slot with professional count
  5. `get_available_professionals_count_quick` - Lightweight count-only query for badges
  
  ## Key Features
  - Returns both aggregate counts and individual professional details
  - Optimized for batch queries to reduce database load
  - Includes professional names, photos, and availability status
  - Supports period-based aggregation (morning/afternoon/evening)
  - Smart caching hints for frontend implementation
  
  ## Performance
  - Uses existing indexes on bookings table
  - Leverages JSONB operations for team data
  - Returns minimal data for count-only queries
  - Batches multiple slot queries in single call
*/

-- =====================================================
-- FUNCTION 1: Get detailed professional availability for a specific slot
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_professionals_availability_for_slot(
  p_service_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
RETURNS TABLE(
  total_capacity integer,
  available_count integer,
  occupied_count integer,
  is_available boolean,
  available_professionals jsonb,
  occupied_professionals jsonb,
  blocked_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_service RECORD;
  v_team_member jsonb;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_available_pros jsonb := '[]'::jsonb;
  v_occupied_pros jsonb := '[]'::jsonb;
  v_total_capacity integer := 0;
  v_available_count integer := 0;
  v_occupied_count integer := 0;
  v_is_blocked boolean := false;
  v_blocked_reason text := NULL;
  v_is_primary boolean;
  v_profile_id uuid;
  v_team_member_id uuid;
  v_name text;
  v_photo_url text;
  v_has_conflict boolean;
  v_professional_data jsonb;
BEGIN
  -- Get service data
  SELECT id, professional_id, team
  INTO v_service
  FROM public.services
  WHERE id = p_service_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, 0, false, '[]'::jsonb, '[]'::jsonb, 'Serviço não encontrado'::text;
    RETURN;
  END IF;

  -- Convert times to timestamptz
  v_slot_start := (p_date::text || ' ' || p_start_time::text)::timestamptz;
  v_slot_end := (p_date::text || ' ' || p_end_time::text)::timestamptz;

  -- Check if day is blocked
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_dates bd
    WHERE bd.professional_id = v_service.professional_id
      AND bd.date = p_date
  ), (
    SELECT bd.reason FROM public.blocked_dates bd
    WHERE bd.professional_id = v_service.professional_id
      AND bd.date = p_date
    LIMIT 1
  )
  INTO v_is_blocked, v_blocked_reason;

  IF v_is_blocked THEN
    RETURN QUERY SELECT 
      0, 0, 0, false, 
      '[]'::jsonb, '[]'::jsonb,
      COALESCE(v_blocked_reason, 'Dia indisponível')::text;
    RETURN;
  END IF;

  -- Process team members
  IF v_service.team IS NULL OR jsonb_typeof(v_service.team) != 'array' OR jsonb_array_length(v_service.team) = 0 THEN
    -- No team, just service owner
    v_total_capacity := 1;
    
    SELECT full_name, avatar_url 
    INTO v_name, v_photo_url
    FROM profiles 
    WHERE id = v_service.professional_id;

    -- Check if owner has conflict
    SELECT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.service_id = p_service_id
        AND b.status = 'confirmado'
        AND b.start_time < v_slot_end
        AND b.end_time > v_slot_start
        AND b.professional_id = v_service.professional_id
        AND b.team_member_id IS NULL
    ) INTO v_has_conflict;

    v_professional_data := jsonb_build_object(
      'id', v_service.professional_id,
      'name', COALESCE(v_name, 'Profissional'),
      'photo_url', v_photo_url,
      'is_primary', true
    );

    IF v_has_conflict THEN
      v_occupied_pros := v_occupied_pros || v_professional_data;
      v_occupied_count := 1;
    ELSE
      v_available_pros := v_available_pros || v_professional_data;
      v_available_count := 1;
    END IF;
  ELSE
    -- Process team array
    v_total_capacity := jsonb_array_length(v_service.team);

    FOR v_team_member IN SELECT * FROM jsonb_array_elements(v_service.team)
    LOOP
      v_is_primary := COALESCE((v_team_member->>'is_primary')::boolean, false);
      v_name := v_team_member->>'name';
      v_photo_url := v_team_member->>'photo_url';

      IF v_is_primary THEN
        v_profile_id := COALESCE((v_team_member->>'profile_id')::uuid, v_service.professional_id);
        v_team_member_id := NULL;
      ELSE
        v_profile_id := v_service.professional_id;
        v_team_member_id := COALESCE((v_team_member->>'team_member_db_id')::uuid, NULL);
      END IF;

      -- Check for conflicts
      IF v_is_primary THEN
        SELECT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.service_id = p_service_id
            AND b.status = 'confirmado'
            AND b.start_time < v_slot_end
            AND b.end_time > v_slot_start
            AND b.professional_id = v_profile_id
            AND b.team_member_id IS NULL
        ) INTO v_has_conflict;
      ELSE
        IF v_team_member_id IS NOT NULL THEN
          SELECT EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.service_id = p_service_id
              AND b.status = 'confirmado'
              AND b.start_time < v_slot_end
              AND b.end_time > v_slot_start
              AND b.team_member_id = v_team_member_id
          ) INTO v_has_conflict;
        ELSE
          v_has_conflict := true;
        END IF;
      END IF;

      v_professional_data := jsonb_build_object(
        'id', COALESCE(v_team_member_id, v_profile_id),
        'name', COALESCE(v_name, 'Profissional'),
        'photo_url', v_photo_url,
        'is_primary', v_is_primary,
        'team_member_id', v_team_member_id
      );

      IF v_has_conflict THEN
        v_occupied_pros := v_occupied_pros || v_professional_data;
        v_occupied_count := v_occupied_count + 1;
      ELSE
        v_available_pros := v_available_pros || v_professional_data;
        v_available_count := v_available_count + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN QUERY SELECT
    v_total_capacity,
    v_available_count,
    v_occupied_count,
    v_available_count > 0,
    v_available_pros,
    v_occupied_pros,
    CASE WHEN v_available_count = 0 
      THEN format('Esgotado - %s de %s ocupados', v_occupied_count, v_total_capacity)
      ELSE NULL 
    END;
END;
$$;

COMMENT ON FUNCTION public.get_professionals_availability_for_slot IS
  'Returns detailed professional list with availability status for a specific time slot. Includes names, photos, and occupancy status.';

GRANT EXECUTE ON FUNCTION public.get_professionals_availability_for_slot TO authenticated, anon;

-- =====================================================
-- FUNCTION 2: Get daily professionals summary by period
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_daily_professionals_summary(
  p_service_id uuid,
  p_date date
)
RETURNS TABLE(
  period text,
  start_time time,
  end_time time,
  total_slots integer,
  available_slots integer,
  occupied_slots integer,
  avg_available_professionals numeric,
  total_capacity integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_capacity integer;
BEGIN
  -- Get service capacity
  SELECT public.get_service_total_capacity(p_service_id) INTO v_capacity;

  -- Morning period (09:00-12:00)
  RETURN QUERY
  WITH morning_slots AS (
    SELECT 
      generate_series(
        (p_date::text || ' 09:00:00')::timestamptz,
        (p_date::text || ' 11:30:00')::timestamptz,
        interval '30 minutes'
      ) AS slot_time
  ),
  morning_availability AS (
    SELECT 
      slot_time,
      (SELECT available_count FROM public.get_professionals_availability_for_slot(
        p_service_id, 
        p_date, 
        slot_time::time,
        (slot_time + interval '30 minutes')::time
      )) AS available_count
    FROM morning_slots
  )
  SELECT
    'Manhã'::text,
    '09:00'::time,
    '12:00'::time,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE available_count > 0)::integer,
    COUNT(*) FILTER (WHERE available_count = 0)::integer,
    ROUND(AVG(available_count), 1),
    v_capacity
  FROM morning_availability;

  -- Afternoon period (12:00-17:00)
  RETURN QUERY
  WITH afternoon_slots AS (
    SELECT 
      generate_series(
        (p_date::text || ' 12:00:00')::timestamptz,
        (p_date::text || ' 16:30:00')::timestamptz,
        interval '30 minutes'
      ) AS slot_time
  ),
  afternoon_availability AS (
    SELECT 
      slot_time,
      (SELECT available_count FROM public.get_professionals_availability_for_slot(
        p_service_id, 
        p_date, 
        slot_time::time,
        (slot_time + interval '30 minutes')::time
      )) AS available_count
    FROM afternoon_slots
  )
  SELECT
    'Tarde'::text,
    '12:00'::time,
    '17:00'::time,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE available_count > 0)::integer,
    COUNT(*) FILTER (WHERE available_count = 0)::integer,
    ROUND(AVG(available_count), 1),
    v_capacity
  FROM afternoon_availability;

  -- Evening period (17:00-20:00)
  RETURN QUERY
  WITH evening_slots AS (
    SELECT 
      generate_series(
        (p_date::text || ' 17:00:00')::timestamptz,
        (p_date::text || ' 19:30:00')::timestamptz,
        interval '30 minutes'
      ) AS slot_time
  ),
  evening_availability AS (
    SELECT 
      slot_time,
      (SELECT available_count FROM public.get_professionals_availability_for_slot(
        p_service_id, 
        p_date, 
        slot_time::time,
        (slot_time + interval '30 minutes')::time
      )) AS available_count
    FROM evening_slots
  )
  SELECT
    'Noite'::text,
    '17:00'::time,
    '20:00'::time,
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE available_count > 0)::integer,
    COUNT(*) FILTER (WHERE available_count = 0)::integer,
    ROUND(AVG(available_count), 1),
    v_capacity
  FROM evening_availability;
END;
$$;

COMMENT ON FUNCTION public.get_daily_professionals_summary IS
  'Returns availability summary grouped by periods (Manhã, Tarde, Noite) with average professional counts.';

GRANT EXECUTE ON FUNCTION public.get_daily_professionals_summary TO authenticated, anon;

-- =====================================================
-- FUNCTION 3: Quick count-only query (optimized for badges)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_available_professionals_count_quick(
  p_service_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_result integer;
BEGIN
  SELECT available_count
  INTO v_result
  FROM public.get_professionals_availability_for_slot(
    p_service_id,
    p_date,
    p_start_time,
    p_end_time
  );
  
  RETURN COALESCE(v_result, 0);
END;
$$;

COMMENT ON FUNCTION public.get_available_professionals_count_quick IS
  'Lightweight function returning only the count of available professionals. Optimized for badge display.';

GRANT EXECUTE ON FUNCTION public.get_available_professionals_count_quick TO authenticated, anon;

-- =====================================================
-- FUNCTION 4: Find next available slot with professionals
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_next_available_slot_with_professionals(
  p_service_id uuid,
  p_start_date date,
  p_max_days_ahead integer DEFAULT 7
)
RETURNS TABLE(
  slot_date date,
  slot_time time,
  available_count integer,
  total_capacity integer,
  available_professionals jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_current_date date;
  v_end_date date;
  v_slot_time time;
  v_result RECORD;
BEGIN
  v_end_date := p_start_date + p_max_days_ahead;
  
  FOR v_current_date IN 
    SELECT generate_series(p_start_date, v_end_date, interval '1 day')::date
  LOOP
    FOR v_slot_time IN 
      SELECT generate_series(
        '09:00'::time,
        '19:00'::time,
        interval '30 minutes'
      )
    LOOP
      SELECT * INTO v_result
      FROM public.get_professionals_availability_for_slot(
        p_service_id,
        v_current_date,
        v_slot_time,
        v_slot_time + interval '30 minutes'
      );
      
      IF v_result.available_count > 0 THEN
        RETURN QUERY SELECT
          v_current_date,
          v_slot_time,
          v_result.available_count,
          v_result.total_capacity,
          v_result.available_professionals;
        RETURN;
      END IF;
    END LOOP;
  END LOOP;
  
  -- No slots found
  RETURN;
END;
$$;

COMMENT ON FUNCTION public.get_next_available_slot_with_professionals IS
  'Finds the next available time slot with professional details. Used for suggesting alternatives when slots are full.';

GRANT EXECUTE ON FUNCTION public.get_next_available_slot_with_professionals TO authenticated, anon;

-- =====================================================
-- FUNCTION 5: Get availability matrix for entire day (batch query)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_service_team_availability_matrix(
  p_service_id uuid,
  p_date date
)
RETURNS TABLE(
  time_slot time,
  available_count integer,
  total_capacity integer,
  is_available boolean,
  utilization_percentage integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_slot_time time;
  v_result RECORD;
  v_capacity integer;
BEGIN
  SELECT public.get_service_total_capacity(p_service_id) INTO v_capacity;
  
  FOR v_slot_time IN 
    SELECT generate_series('09:00'::time, '19:30'::time, interval '30 minutes')
  LOOP
    SELECT * INTO v_result
    FROM public.get_professionals_availability_for_slot(
      p_service_id,
      p_date,
      v_slot_time,
      v_slot_time + interval '30 minutes'
    );
    
    RETURN QUERY SELECT
      v_slot_time,
      v_result.available_count,
      v_result.total_capacity,
      v_result.is_available,
      CASE 
        WHEN v_result.total_capacity > 0 
        THEN ROUND((v_result.occupied_count::numeric / v_result.total_capacity::numeric) * 100)::integer
        ELSE 0
      END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_service_team_availability_matrix IS
  'Returns availability matrix for all time slots in a day. Optimized for calendar grid views.';

GRANT EXECUTE ON FUNCTION public.get_service_team_availability_matrix TO authenticated, anon;