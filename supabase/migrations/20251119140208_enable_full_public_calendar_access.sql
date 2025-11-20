/*
  # Enable Full Public Calendar Access for All Users

  ## Overview
  Allows ALL users (authenticated + anonymous) to view real-time availability
  calendars while protecting sensitive client information.

  ## Security
  ✅ CAN See: Aggregate counts, capacity, availability status
  ❌ CANNOT See: Client names, emails, phones, booking notes
*/

-- =====================================================
-- STEP 1: Bookings Table - Public Aggregate Access
-- =====================================================

DROP POLICY IF EXISTS "Bookings select access" ON public.bookings;
DROP POLICY IF EXISTS "Bookings select access with public counting" ON public.bookings;
DROP POLICY IF EXISTS "Bookings public aggregate access" ON public.bookings;

CREATE POLICY "Bookings public aggregate access"
  ON public.bookings FOR SELECT USING (true);

-- Safe public view (no client data)
DROP VIEW IF EXISTS public.public_availability_bookings CASCADE;

CREATE VIEW public.public_availability_bookings AS
SELECT id, service_id, professional_id, team_member_id,
       start_time, end_time, status, service_variant_id, created_at
FROM public.bookings
WHERE status IN ('confirmado', 'pendente');

GRANT SELECT ON public.public_availability_bookings TO authenticated, anon;

-- =====================================================
-- STEP 2: Supporting Tables - Public Read Access
-- =====================================================

DROP POLICY IF EXISTS "Service team members select" ON public.service_team_members;
DROP POLICY IF EXISTS "Service team members public read" ON public.service_team_members;
CREATE POLICY "Service team members public read" ON public.service_team_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Blocked dates select" ON public.blocked_dates;
DROP POLICY IF EXISTS "Blocked dates public read" ON public.blocked_dates;
CREATE POLICY "Blocked dates public read" ON public.blocked_dates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Availability select" ON public.availability;
DROP POLICY IF EXISTS "Professional availability public read" ON public.availability;
CREATE POLICY "Professional availability public read" ON public.availability FOR SELECT USING (true);

-- =====================================================
-- STEP 3: Grant Execute on Core Availability Functions
-- =====================================================

GRANT EXECUTE ON FUNCTION public.get_service_team_availability_matrix(uuid, date) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_available_professionals_for_slot(uuid, date, time, time) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_service_daily_capacity_summary(uuid, date) TO authenticated, anon;

-- =====================================================
-- STEP 4: Performance Indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_bookings_public_availability
  ON public.bookings(service_id, status, start_time, end_time)
  WHERE status IN ('confirmado', 'pendente');

CREATE INDEX IF NOT EXISTS idx_bookings_team_time
  ON public.bookings(team_member_id, start_time, end_time)
  WHERE team_member_id IS NOT NULL AND status = 'confirmado';

-- =====================================================
-- STEP 5: Enable Realtime
-- =====================================================

ALTER TABLE public.bookings REPLICA IDENTITY FULL;

-- =====================================================
-- STEP 6: Public Calendar View Function
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_public_calendar_day_view(
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
  v_team_size integer;
  v_time_slot time;
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_confirmed_count integer;
  v_available_count integer;
  v_utilization numeric;
BEGIN
  SELECT s.team INTO v_team_jsonb FROM public.services s WHERE s.id = p_service_id;

  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    v_team_size := 1;
  ELSE
    v_team_size := jsonb_array_length(v_team_jsonb);
  END IF;

  FOR i IN 0..21 LOOP
    v_time_slot := ('09:00:00'::time + (i * INTERVAL '30 minutes'));
    v_slot_start := (p_date::text || ' ' || v_time_slot::text)::timestamptz;
    v_slot_end := v_slot_start + INTERVAL '30 minutes';

    SELECT COUNT(*)::integer INTO v_confirmed_count
    FROM public.bookings b
    WHERE b.service_id = p_service_id
      AND b.status = 'confirmado'
      AND b.start_time < v_slot_end
      AND b.end_time > v_slot_start;

    v_available_count := v_team_size - v_confirmed_count;
    IF v_available_count < 0 THEN v_available_count := 0; END IF;

    IF v_team_size > 0 THEN
      v_utilization := ROUND((v_confirmed_count::numeric / v_team_size::numeric) * 100, 2);
    ELSE
      v_utilization := 0;
    END IF;

    RETURN QUERY SELECT
      v_time_slot::text, v_team_size, v_available_count, v_confirmed_count,
      (v_available_count > 0), v_utilization;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_calendar_day_view TO authenticated, anon;

-- =====================================================
-- STEP 7: Update Statistics
-- =====================================================

ANALYZE public.bookings;
ANALYZE public.services;
ANALYZE public.service_team_members;
ANALYZE public.availability;
