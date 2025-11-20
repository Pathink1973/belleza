/*
  # Complete Availability Synchronization System - Phase 1
  
  ## Overview
  This migration fixes the fundamental counting logic across the entire booking system.
  It ensures that available slots are calculated correctly as: (Team Size × Time Slots) - Confirmed Bookings
  
  ## Critical Changes
  
  1. **Cross-Service Professional Availability**
     - Professionals can work on multiple services
     - Availability must be checked GLOBALLY across ALL services
     - A confirmed booking in Service A blocks availability in Service B for the same professional
  
  2. **Correct Slot Counting Formula**
     - Total Slots = Team Size × Number of Time Slots
     - Available Slots = Total Slots - Confirmed Bookings
     - Example: 2 professionals, 11 time slots, 2 confirmed = (2 × 11) - 2 = 20 available
  
  3. **Pending vs Confirmed Logic**
     - ONLY confirmed bookings reduce capacity
     - Pending bookings are visible but DO NOT block slots
     - Multiple pending bookings can exist for the same slot
  
  4. **Granular Availability States**
     - Not binary green/red - show exact counts
     - Display: "20 vagas", "1 vaga", "Esgotado (0/22)"
     - Color based on percentage: green (80-100%), yellow (50-79%), orange (20-49%), red (0-19%)
*/

-- =====================================================
-- STEP 0: Drop existing functions with correct signatures
-- =====================================================

DROP FUNCTION IF EXISTS public.get_service_team_availability_matrix(uuid, date);
DROP FUNCTION IF EXISTS public.get_service_daily_capacity_summary(uuid, date);
DROP FUNCTION IF EXISTS public.get_available_professionals_for_slot(uuid, date, time, time);

-- =====================================================
-- STEP 1: Create global professional availability checker
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_professional_global_availability(
  p_professional_id uuid,
  p_team_member_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_has_conflict boolean := false;
BEGIN
  -- Convert to timestamptz
  v_slot_start := (p_date::text || ' ' || p_start_time::text)::timestamptz;
  v_slot_end := (p_date::text || ' ' || p_end_time::text)::timestamptz;

  -- CRITICAL: Check conflicts across ALL services, not just one service
  -- A professional can only be in ONE place at a time
  
  IF p_team_member_id IS NOT NULL THEN
    -- Check team member availability across ALL services
    SELECT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.team_member_id = p_team_member_id
        AND b.status = 'confirmado'
        AND b.start_time < v_slot_end
        AND b.end_time > v_slot_start
        AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    ) INTO v_has_conflict;
  ELSE
    -- Check primary professional availability across ALL services
    SELECT EXISTS (
      SELECT 1
      FROM public.bookings b
      WHERE b.professional_id = p_professional_id
        AND b.team_member_id IS NULL
        AND b.status = 'confirmado'
        AND b.start_time < v_slot_end
        AND b.end_time > v_slot_start
        AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
    ) INTO v_has_conflict;
  END IF;

  -- Return true if available (no conflict), false if occupied
  RETURN NOT v_has_conflict;
END;
$$;

COMMENT ON FUNCTION public.get_professional_global_availability IS
  'Checks if a professional is available at a specific time across ALL services. Returns true if available, false if occupied.';

GRANT EXECUTE ON FUNCTION public.get_professional_global_availability TO authenticated, anon;

-- =====================================================
-- STEP 2: Create FIXED get_service_team_availability_matrix
-- This is the CRITICAL function that was counting wrong
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
  utilization_percentage numeric
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

  -- Generate time slots from 09:00 to 19:00 (30-minute intervals)
  FOR v_hour IN 9..19 LOOP
    FOR v_minute IN 0..30 BY 30 LOOP
      -- Skip 19:30 onwards
      IF v_hour = 19 AND v_minute = 30 THEN
        EXIT;
      END IF;

      -- Create time slot
      v_start_time := make_time(v_hour, v_minute, 0);
      
      -- Calculate end time (30 minutes later)
      IF v_minute = 30 THEN
        v_end_time := make_time(v_hour + 1, 0, 0);
      ELSE
        v_end_time := make_time(v_hour, v_minute + 30, 0);
      END IF;

      -- Convert to timestamptz for comparison
      v_slot_start := (p_date::text || ' ' || v_start_time::text)::timestamptz;
      v_slot_end := (p_date::text || ' ' || v_end_time::text)::timestamptz;

      -- CRITICAL FIX: Count ONLY confirmed bookings for this specific slot
      SELECT COUNT(*)::integer
      INTO v_confirmed_count
      FROM public.bookings b
      WHERE b.service_id = p_service_id
        AND b.status = 'confirmado'
        AND b.start_time < v_slot_end
        AND b.end_time > v_slot_start;

      -- CORRECT CALCULATION
      -- Available = Team Size - Confirmed Bookings
      -- Example: 2 professionals - 0 bookings = 2 available
      -- Example: 2 professionals - 1 booking = 1 available
      -- Example: 2 professionals - 2 bookings = 0 available (Esgotado)
      v_available_count := v_team_size - v_confirmed_count;
      
      -- Ensure non-negative
      IF v_available_count < 0 THEN
        v_available_count := 0;
      END IF;

      v_occupied_count := v_confirmed_count;

      -- Calculate utilization percentage
      IF v_team_size > 0 THEN
        v_utilization := ROUND((v_occupied_count::numeric / v_team_size::numeric) * 100, 2);
      ELSE
        v_utilization := 0;
      END IF;

      -- Return row for this time slot
      RETURN QUERY SELECT
        v_start_time::text,
        v_team_size,
        v_available_count,
        v_occupied_count,
        (v_available_count > 0),
        v_utilization;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_service_team_availability_matrix IS
  'Returns availability matrix for a service on a specific date. FIXED: Correctly calculates available = team_size - confirmed_bookings for each slot.';

GRANT EXECUTE ON FUNCTION public.get_service_team_availability_matrix TO authenticated, anon;

-- =====================================================
-- STEP 3: Create FIXED get_service_daily_capacity_summary
-- This provides the DAILY TOTAL that badges display
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_service_daily_capacity_summary(
  p_service_id uuid,
  p_date date
)
RETURNS TABLE(
  total_capacity integer,
  total_slots integer,
  available_slots integer,
  occupied_slots integer,
  fully_booked_slots integer,
  occupation_percentage numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_team_size integer := 0;
  v_total_time_slots integer := 0;
  v_total_capacity_slots integer := 0;
  v_confirmed_bookings_count integer := 0;
  v_available_slots integer := 0;
  v_fully_booked_count integer := 0;
  v_occupation_pct numeric := 0;
  v_team_jsonb jsonb;
  v_service_owner_id uuid;
  v_day_start timestamptz;
  v_day_end timestamptz;
BEGIN
  -- Get service data
  SELECT s.professional_id, s.team
  INTO v_service_owner_id, v_team_jsonb
  FROM public.services s
  WHERE s.id = p_service_id;

  IF v_service_owner_id IS NULL THEN
    RAISE EXCEPTION 'Service not found: %', p_service_id;
  END IF;

  -- Calculate team size
  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    v_team_size := 1;
  ELSE
    v_team_size := jsonb_array_length(v_team_jsonb);
  END IF;

  -- Calculate total time slots in a day (09:00 to 19:00, 30-min intervals)
  -- 09:00, 09:30, 10:00, ..., 18:00, 18:30, 19:00 = 21 slots
  v_total_time_slots := 21;

  -- CRITICAL FIX: Total capacity = Team Size × Time Slots
  -- Example: 2 professionals × 11 time slots = 22 total capacity slots
  v_total_capacity_slots := v_team_size * v_total_time_slots;

  -- Set day boundaries
  v_day_start := p_date::timestamptz;
  v_day_end := (p_date + interval '1 day')::timestamptz;

  -- Count ONLY confirmed bookings for this day and service
  SELECT COUNT(*)::integer
  INTO v_confirmed_bookings_count
  FROM public.bookings b
  WHERE b.service_id = p_service_id
    AND b.status = 'confirmado'
    AND b.start_time >= v_day_start
    AND b.start_time < v_day_end;

  -- CORRECT CALCULATION
  -- Available Slots = Total Capacity Slots - Confirmed Bookings
  -- Example: 22 total - 2 confirmed = 20 available
  v_available_slots := v_total_capacity_slots - v_confirmed_bookings_count;

  -- Ensure non-negative
  IF v_available_slots < 0 THEN
    v_available_slots := 0;
  END IF;

  -- Count fully booked time slots (where all professionals are occupied)
  SELECT COUNT(*)::integer
  INTO v_fully_booked_count
  FROM (
    SELECT 
      date_trunc('hour', b.start_time) + 
      (floor(extract(minute from b.start_time) / 30) * interval '30 minute') as slot_time,
      COUNT(*) as bookings_in_slot
    FROM public.bookings b
    WHERE b.service_id = p_service_id
      AND b.status = 'confirmado'
      AND b.start_time >= v_day_start
      AND b.start_time < v_day_end
    GROUP BY slot_time
    HAVING COUNT(*) >= v_team_size
  ) fully_booked;

  -- Calculate occupation percentage
  IF v_total_capacity_slots > 0 THEN
    v_occupation_pct := ROUND((v_confirmed_bookings_count::numeric / v_total_capacity_slots::numeric) * 100, 2);
  ELSE
    v_occupation_pct := 0;
  END IF;

  -- Return summary
  RETURN QUERY SELECT
    v_team_size,                    -- total_capacity (professionals per slot)
    v_total_capacity_slots,         -- total_slots (professionals × time_slots)
    v_available_slots,              -- available_slots (total - confirmed)
    v_confirmed_bookings_count,     -- occupied_slots (confirmed bookings)
    v_fully_booked_count,           -- fully_booked_slots (time slots with all professionals occupied)
    v_occupation_pct;               -- occupation_percentage
END;
$$;

COMMENT ON FUNCTION public.get_service_daily_capacity_summary IS
  'Returns daily capacity summary with CORRECT calculation: total_slots = team_size × time_slots, available = total - confirmed';

GRANT EXECUTE ON FUNCTION public.get_service_daily_capacity_summary TO authenticated, anon;

-- =====================================================
-- STEP 4: Update get_available_professionals_for_slot
-- Add cross-service availability checking
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_available_professionals_for_slot(
  p_service_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
RETURNS TABLE(
  unique_id text,
  profile_id uuid,
  team_member_id uuid,
  full_name text,
  avatar_url text,
  is_primary boolean
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_service RECORD;
  v_team_member jsonb;
  v_is_primary boolean;
  v_profile_id uuid;
  v_team_member_id uuid;
  v_unique_id text;
  v_full_name text;
  v_avatar_url text;
  v_is_available boolean;
BEGIN
  -- Get service data
  SELECT s.id, s.professional_id, s.team
  INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id;

  IF v_service.id IS NULL THEN
    RETURN;
  END IF;

  -- Handle empty team (single professional)
  IF v_service.team IS NULL OR jsonb_typeof(v_service.team) != 'array' OR jsonb_array_length(v_service.team) = 0 THEN
    -- Get professional info
    SELECT p.full_name, p.avatar_url
    INTO v_full_name, v_avatar_url
    FROM public.profiles p
    WHERE p.id = v_service.professional_id;

    -- Check GLOBAL availability across ALL services
    SELECT public.get_professional_global_availability(
      v_service.professional_id,
      NULL,
      p_date,
      p_start_time,
      p_end_time,
      NULL
    ) INTO v_is_available;

    IF v_is_available THEN
      RETURN QUERY SELECT
        v_service.professional_id::text,
        v_service.professional_id,
        NULL::uuid,
        v_full_name,
        v_avatar_url,
        true;
    END IF;
    RETURN;
  END IF;

  -- Process each team member
  FOR v_team_member IN SELECT * FROM jsonb_array_elements(v_service.team)
  LOOP
    v_is_primary := COALESCE((v_team_member->>'is_primary')::boolean, false);
    v_full_name := v_team_member->>'name';
    v_avatar_url := v_team_member->>'imageUrl';

    IF v_is_primary THEN
      v_profile_id := COALESCE((v_team_member->>'profile_id')::uuid, v_service.professional_id);
      v_team_member_id := NULL;
      v_unique_id := v_profile_id::text;
    ELSE
      v_profile_id := v_service.professional_id;
      v_team_member_id := (v_team_member->>'team_member_db_id')::uuid;
      v_unique_id := COALESCE(v_team_member_id::text, v_profile_id::text);
    END IF;

    -- Skip invalid team members
    IF v_unique_id IS NULL THEN
      CONTINUE;
    END IF;

    -- CRITICAL: Check GLOBAL availability across ALL services
    SELECT public.get_professional_global_availability(
      v_profile_id,
      v_team_member_id,
      p_date,
      p_start_time,
      p_end_time,
      NULL
    ) INTO v_is_available;

    -- Only return if available
    IF v_is_available THEN
      RETURN QUERY SELECT
        v_unique_id,
        v_profile_id,
        v_team_member_id,
        v_full_name,
        v_avatar_url,
        v_is_primary;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_available_professionals_for_slot IS
  'Returns list of professionals available for a specific time slot. UPDATED: Now checks availability across ALL services globally.';

GRANT EXECUTE ON FUNCTION public.get_available_professionals_for_slot TO authenticated, anon;

-- =====================================================
-- STEP 5: Create indexes for cross-service queries
-- =====================================================

-- Optimize cross-service professional availability queries
CREATE INDEX IF NOT EXISTS idx_bookings_cross_service_professional
ON bookings(professional_id, start_time, end_time, status)
WHERE status = 'confirmado' AND team_member_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_cross_service_team_member
ON bookings(team_member_id, start_time, end_time, status)
WHERE status = 'confirmado' AND team_member_id IS NOT NULL;

-- Optimize daily capacity summary queries
CREATE INDEX IF NOT EXISTS idx_bookings_daily_summary
ON bookings(service_id, status, start_time)
WHERE status = 'confirmado';

-- =====================================================
-- STEP 6: Add validation trigger for cross-service conflicts
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_cross_service_double_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_available boolean;
BEGIN
  -- Only validate confirmed bookings
  IF NEW.status = 'confirmado' THEN
    -- Check global availability
    SELECT public.get_professional_global_availability(
      NEW.professional_id,
      NEW.team_member_id,
      NEW.start_time::date,
      NEW.start_time::time,
      NEW.end_time::time,
      NEW.id
    ) INTO v_is_available;

    IF NOT v_is_available THEN
      RAISE EXCEPTION 'Professional is not available at this time (conflict in another service or booking)';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS check_cross_service_conflicts_trigger ON bookings;

-- Create trigger
CREATE TRIGGER check_cross_service_conflicts_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION prevent_cross_service_double_booking();

COMMENT ON FUNCTION public.prevent_cross_service_double_booking IS
  'Trigger function that prevents double-booking across services by checking global professional availability';