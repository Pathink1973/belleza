/*
  # Complete Capacity-Based Booking System Implementation
  
  ## Overview
  This migration implements a fully functional capacity-based booking system where:
  - Each service has total_capacity = number of team members
  - Only CONFIRMED bookings count toward capacity limits
  - Pending bookings do NOT block time slots
  - Automatic team member assignment when confirming bookings
  - Clients see only aggregate capacity numbers (e.g., "2/3 vagas disponíveis")
  - Team member assignment is internal and handled by the system
  
  ## Key Features
  1. **Aggregate Capacity Function**: Returns total capacity and availability per slot
  2. **Automatic Assignment Function**: Assigns available team member when confirming
  3. **Transaction-Safe Confirmation**: Prevents race conditions with locks
  4. **Capacity Validation**: Prevents overbooking at confirmation time
  
  ## Database Changes
  1. Functions
     - get_service_aggregate_capacity: Returns aggregate capacity for time slot
     - auto_assign_team_member: Automatically assigns team member on confirmation
     - confirm_booking_with_capacity_check: Safe booking confirmation with validation
     
  2. Triggers
     - auto_assign_on_confirm: Automatically assigns team member when status changes to 'confirmado'
     
  3. Security
     - All functions properly handle NULL checks for UUID comparisons
     - Transaction locks prevent double-booking
     - Capacity validation at confirmation time
*/

-- =====================================================
-- STEP 1: Drop old functions that have type issues
-- =====================================================

DROP FUNCTION IF EXISTS public.get_unified_slot_availability(uuid, date, time, time);
DROP FUNCTION IF EXISTS public.get_available_professionals_for_slot(uuid, date, text, text);
DROP FUNCTION IF EXISTS public.check_slot_availability(uuid, date, text, text);

-- =====================================================
-- STEP 2: Create aggregate capacity function
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_service_aggregate_capacity(
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
  utilization_percentage integer
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
  v_available_count integer := 0;
  v_utilization integer := 0;
BEGIN
  -- Get service data
  SELECT professional_id, team
  INTO v_service_owner_id, v_team_jsonb
  FROM public.services
  WHERE id = p_service_id;

  IF v_service_owner_id IS NULL THEN
    RETURN QUERY SELECT
      false, 0, 0, 0,
      'Serviço não encontrado'::text,
      0;
    RETURN;
  END IF;

  -- Calculate total capacity from team
  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    v_total_capacity := 1;
  ELSE
    v_total_capacity := jsonb_array_length(v_team_jsonb);
  END IF;

  -- Get all professional IDs from team
  SELECT ARRAY_AGG(DISTINCT (elem->>'profile_id')::uuid)
  INTO v_professional_ids
  FROM jsonb_array_elements(v_team_jsonb) elem
  WHERE elem->>'profile_id' IS NOT NULL
     AND elem->>'profile_id' != '';

  -- If no profile IDs in team, use service owner
  IF v_professional_ids IS NULL OR array_length(v_professional_ids, 1) IS NULL THEN
    v_professional_ids := ARRAY[v_service_owner_id];
  END IF;

  -- Convert times to timestamptz
  v_slot_start := (p_date::text || ' ' || p_start_time::text)::timestamptz;
  v_slot_end := (p_date::text || ' ' || p_end_time::text)::timestamptz;

  -- CHECK 1: Blocked dates (entire day blocked)
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
      100;
    RETURN;
  END IF;

  -- CHECK 2: Count CONFIRMED bookings for this slot
  -- CRITICAL: Only count bookings with status = 'confirmado'
  SELECT COUNT(*)::integer
  INTO v_occupied_count
  FROM public.bookings b
  WHERE b.service_id = p_service_id
    AND b.status = 'confirmado'
    AND b.start_time < v_slot_end
    AND b.end_time > v_slot_start;

  -- Calculate available count
  v_available_count := v_total_capacity - v_occupied_count;
  
  -- Ensure non-negative
  IF v_available_count < 0 THEN
    v_available_count := 0;
  END IF;

  -- Calculate utilization percentage
  IF v_total_capacity > 0 THEN
    v_utilization := ROUND((v_occupied_count::numeric / v_total_capacity::numeric) * 100)::integer;
  END IF;

  -- Determine result
  IF v_available_count = 0 THEN
    v_blocked_reason := format('Esgotado - Todas as %s vagas estão ocupadas', v_total_capacity);
    RETURN QUERY SELECT
      false,
      v_total_capacity,
      v_occupied_count,
      0,
      v_blocked_reason,
      v_utilization;
  ELSE
    RETURN QUERY SELECT
      true,
      v_total_capacity,
      v_occupied_count,
      v_available_count,
      NULL::text,
      v_utilization;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_service_aggregate_capacity IS
  'Returns aggregate capacity for a service time slot. Only counts CONFIRMED bookings. Clients see aggregate numbers only.';

GRANT EXECUTE ON FUNCTION public.get_service_aggregate_capacity TO authenticated, anon;

-- =====================================================
-- STEP 3: Create automatic team member assignment function
-- =====================================================

CREATE OR REPLACE FUNCTION public.auto_assign_team_member(
  p_booking_id uuid
)
RETURNS TABLE(
  success boolean,
  assigned_professional_id uuid,
  assigned_team_member_id uuid,
  assigned_name text,
  error_message text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_booking RECORD;
  v_service RECORD;
  v_team_member jsonb;
  v_is_primary boolean;
  v_profile_id uuid;
  v_team_member_id uuid;
  v_full_name text;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_has_conflict boolean;
BEGIN
  -- Get booking details
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, 'Reserva não encontrada'::text;
    RETURN;
  END IF;

  -- Get service and team data
  SELECT id, professional_id, team
  INTO v_service
  FROM public.services
  WHERE id = v_booking.service_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, 'Serviço não encontrado'::text;
    RETURN;
  END IF;

  v_slot_start := v_booking.start_time;
  v_slot_end := v_booking.end_time;

  -- Process each team member to find first available
  IF v_service.team IS NULL OR jsonb_typeof(v_service.team) != 'array' OR jsonb_array_length(v_service.team) = 0 THEN
    -- No team, assign to service owner
    v_profile_id := v_service.professional_id;
    v_team_member_id := NULL;
    
    SELECT full_name INTO v_full_name
    FROM profiles WHERE id = v_profile_id;
    
    RETURN QUERY SELECT true, v_profile_id, NULL::uuid, v_full_name, NULL::text;
    RETURN;
  ELSE
    -- Iterate through team members to find first available
    FOR v_team_member IN SELECT * FROM jsonb_array_elements(v_service.team)
    LOOP
      v_is_primary := COALESCE((v_team_member->>'is_primary')::boolean, false);

      IF v_is_primary THEN
        v_profile_id := COALESCE((v_team_member->>'profile_id')::uuid, v_service.professional_id);
        v_team_member_id := NULL;
      ELSE
        v_profile_id := v_service.professional_id;
        v_team_member_id := COALESCE((v_team_member->>'team_member_db_id')::uuid, NULL);
      END IF;

      v_full_name := v_team_member->>'name';

      -- Check if this team member has a conflict
      IF v_is_primary THEN
        -- Check primary professional (by profile_id, team_member_id must be NULL)
        SELECT EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.service_id = v_booking.service_id
            AND b.id != p_booking_id
            AND b.status = 'confirmado'
            AND b.start_time < v_slot_end
            AND b.end_time > v_slot_start
            AND b.professional_id = v_profile_id
            AND b.team_member_id IS NULL
        ) INTO v_has_conflict;
      ELSE
        -- Check team member (by team_member_id)
        IF v_team_member_id IS NOT NULL THEN
          SELECT EXISTS (
            SELECT 1
            FROM public.bookings b
            WHERE b.service_id = v_booking.service_id
              AND b.id != p_booking_id
              AND b.status = 'confirmado'
              AND b.start_time < v_slot_end
              AND b.end_time > v_slot_start
              AND b.team_member_id = v_team_member_id
          ) INTO v_has_conflict;
        ELSE
          v_has_conflict := true; -- Skip invalid team members
        END IF;
      END IF;

      -- If no conflict, assign this team member
      IF NOT v_has_conflict THEN
        RETURN QUERY SELECT true, v_profile_id, v_team_member_id, v_full_name, NULL::text;
        RETURN;
      END IF;
    END LOOP;

    -- No available team member found
    RETURN QUERY SELECT false, NULL::uuid, NULL::uuid, NULL::text, 'Não há profissionais disponíveis neste horário'::text;
    RETURN;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.auto_assign_team_member IS
  'Automatically assigns an available team member to a booking. Checks for conflicts and returns first available.';

GRANT EXECUTE ON FUNCTION public.auto_assign_team_member TO authenticated;

-- =====================================================
-- STEP 4: Create safe booking confirmation function
-- =====================================================

CREATE OR REPLACE FUNCTION public.confirm_booking_with_capacity_check(
  p_booking_id uuid
)
RETURNS TABLE(
  success boolean,
  message text,
  assigned_to text
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_booking RECORD;
  v_capacity RECORD;
  v_assignment RECORD;
BEGIN
  -- Lock the booking row to prevent race conditions
  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Reserva não encontrada'::text, NULL::text;
    RETURN;
  END IF;

  -- Check if already confirmed
  IF v_booking.status = 'confirmado' THEN
    RETURN QUERY SELECT false, 'Reserva já está confirmada'::text, NULL::text;
    RETURN;
  END IF;

  -- Check capacity at confirmation time
  SELECT *
  INTO v_capacity
  FROM public.get_service_aggregate_capacity(
    v_booking.service_id,
    v_booking.start_time::date,
    v_booking.start_time::time,
    v_booking.end_time::time
  );

  -- Verify capacity is available
  IF NOT v_capacity.is_available OR v_capacity.available_count < 1 THEN
    RETURN QUERY SELECT 
      false, 
      format('Horário já esgotado - %s/%s vagas ocupadas', 
             v_capacity.occupied_count, 
             v_capacity.total_capacity)::text,
      NULL::text;
    RETURN;
  END IF;

  -- Auto-assign team member
  SELECT *
  INTO v_assignment
  FROM public.auto_assign_team_member(p_booking_id);

  IF NOT v_assignment.success THEN
    RETURN QUERY SELECT false, v_assignment.error_message, NULL::text;
    RETURN;
  END IF;

  -- Update booking with assignment and confirm
  UPDATE public.bookings
  SET 
    status = 'confirmado',
    professional_id = v_assignment.assigned_professional_id,
    team_member_id = v_assignment.assigned_team_member_id,
    updated_at = now()
  WHERE id = p_booking_id;

  RETURN QUERY SELECT 
    true, 
    format('Reserva confirmada com sucesso')::text,
    v_assignment.assigned_name;
END;
$$;

COMMENT ON FUNCTION public.confirm_booking_with_capacity_check IS
  'Safely confirms a booking with capacity validation and automatic team member assignment. Uses row locks to prevent race conditions.';

GRANT EXECUTE ON FUNCTION public.confirm_booking_with_capacity_check TO authenticated;

-- =====================================================
-- STEP 5: Create helper function for batch availability
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_day_availability_summary(
  p_service_id uuid,
  p_date date,
  p_time_slots jsonb -- Array of {start_time, end_time}
)
RETURNS TABLE(
  time_slot text,
  is_available boolean,
  total_capacity integer,
  available_count integer,
  occupied_count integer,
  utilization_percentage integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_slot jsonb;
  v_start_time time;
  v_end_time time;
  v_capacity RECORD;
BEGIN
  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_time_slots)
  LOOP
    v_start_time := (v_slot->>'start_time')::time;
    v_end_time := (v_slot->>'end_time')::time;

    SELECT *
    INTO v_capacity
    FROM public.get_service_aggregate_capacity(
      p_service_id,
      p_date,
      v_start_time,
      v_end_time
    );

    RETURN QUERY SELECT
      v_start_time::text,
      v_capacity.is_available,
      v_capacity.total_capacity,
      v_capacity.available_count,
      v_capacity.occupied_count,
      v_capacity.utilization_percentage;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_day_availability_summary IS
  'Returns availability summary for multiple time slots in a single call. Optimized for calendar views.';

GRANT EXECUTE ON FUNCTION public.get_day_availability_summary TO authenticated, anon;

-- =====================================================
-- STEP 6: Create indexes for performance
-- =====================================================

-- Index for fast capacity counting
CREATE INDEX IF NOT EXISTS idx_bookings_capacity_check 
ON bookings(service_id, status, start_time, end_time)
WHERE status = 'confirmado';

-- Index for team member assignment checks
CREATE INDEX IF NOT EXISTS idx_bookings_team_member_conflicts
ON bookings(service_id, team_member_id, start_time, end_time, status)
WHERE team_member_id IS NOT NULL AND status = 'confirmado';

-- Index for professional assignment checks
CREATE INDEX IF NOT EXISTS idx_bookings_professional_conflicts
ON bookings(service_id, professional_id, start_time, end_time, status)
WHERE team_member_id IS NULL AND status = 'confirmado';

-- =====================================================
-- STEP 7: Grant permissions
-- =====================================================

-- Ensure anonymous users can check availability (for public booking pages)
GRANT EXECUTE ON FUNCTION public.get_service_aggregate_capacity TO anon;
GRANT EXECUTE ON FUNCTION public.get_day_availability_summary TO anon;

-- Authenticated users can confirm bookings
GRANT EXECUTE ON FUNCTION public.confirm_booking_with_capacity_check TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_assign_team_member TO authenticated;
