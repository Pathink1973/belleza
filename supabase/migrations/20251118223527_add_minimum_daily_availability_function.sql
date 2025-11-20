/*
  # Add Minimum Daily Availability Function
  
  ## Purpose
  Provides accurate daily availability summary for calendar badges by checking 
  ALL time slots in the day and returning the WORST CASE (minimum availability).
  
  ## Why This is Critical
  Previous implementation used a single sample time (10:00-10:30) to represent the entire day.
  This caused incorrect badge displays:
  - If 10:00 slot had 1 vaga available but 16:30 slot had 0 vagas, badge showed "1 vaga" ❌
  - Badge should show "0 vagas" (the worst case) to accurately represent the day ✅
  
  ## Function Behavior
  1. Generates all 30-minute slots from 09:00 to 19:30 (22 slots total)
  2. For each slot, calls get_professionals_availability_for_slot
  3. Returns the MINIMUM available count across all slots
  4. Also returns total capacity and availability percentage
  
  ## Returns
  - min_available: Minimum professionals available in any slot (worst case)
  - total_capacity: Service capacity
  - availability_percentage: (min_available / total_capacity) * 100
  - min_slot_time: Time of the most restricted slot
  - total_slots_checked: Number of slots analyzed
  
  ## Example
  Service with 2 professionals:
  - 09:00-09:30: 2 available
  - 10:00-10:30: 2 available
  - ...
  - 16:30-17:00: 0 available (both professionals booked) ← WORST CASE
  - ...
  - 19:00-19:30: 1 available
  
  Result: min_available = 0, badge shows "0 vagas" (RED) ✅
*/

-- =====================================================
-- Function: Get minimum availability for entire day
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_daily_minimum_availability(
  p_service_id uuid,
  p_date date
)
RETURNS TABLE(
  min_available integer,
  total_capacity integer,
  availability_percentage numeric,
  min_slot_time time,
  total_slots_checked integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_slot_time time;
  v_result RECORD;
  v_capacity integer;
  v_min_available integer := NULL;
  v_min_slot_time time := NULL;
  v_slots_checked integer := 0;
BEGIN
  -- Get service capacity
  SELECT public.get_service_total_capacity(p_service_id) INTO v_capacity;
  
  -- Check all time slots from 09:00 to 19:30 (30-minute intervals)
  FOR v_slot_time IN 
    SELECT generate_series('09:00'::time, '19:00'::time, interval '30 minutes')
  LOOP
    v_slots_checked := v_slots_checked + 1;
    
    -- Get availability for this slot
    SELECT * INTO v_result
    FROM public.get_professionals_availability_for_slot(
      p_service_id,
      p_date,
      v_slot_time,
      v_slot_time + interval '30 minutes'
    );
    
    -- Track minimum availability (worst case scenario)
    IF v_min_available IS NULL OR v_result.available_count < v_min_available THEN
      v_min_available := v_result.available_count;
      v_min_slot_time := v_slot_time;
    END IF;
    
    -- If we find a slot with 0 availability, no need to check further
    -- (we already found the worst case)
    IF v_result.available_count = 0 THEN
      EXIT;
    END IF;
  END LOOP;
  
  -- Return the worst case availability for the day
  RETURN QUERY SELECT
    COALESCE(v_min_available, 0),
    v_capacity,
    CASE 
      WHEN v_capacity > 0 THEN ROUND((COALESCE(v_min_available, 0)::numeric / v_capacity::numeric) * 100, 1)
      ELSE 0::numeric
    END,
    v_min_slot_time,
    v_slots_checked;
END;
$$;

COMMENT ON FUNCTION public.get_daily_minimum_availability IS
  'Returns the MINIMUM availability for a service on a given day by checking all time slots.
  This ensures calendar badges accurately reflect the worst case scenario.
  Badge shows "0 vagas" only if ALL professionals are booked in at least one slot.
  Optimized with early exit when 0 availability is found.';

GRANT EXECUTE ON FUNCTION public.get_daily_minimum_availability TO authenticated, anon;

-- =====================================================
-- Function: Batch query for multiple days (optimized)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_monthly_minimum_availability(
  p_service_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(
  date date,
  min_available integer,
  total_capacity integer,
  availability_percentage numeric,
  min_slot_time time
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_current_date date;
  v_result RECORD;
BEGIN
  -- Loop through each day in the range
  FOR v_current_date IN 
    SELECT generate_series(p_start_date, p_end_date, interval '1 day')::date
  LOOP
    -- Get minimum availability for this day
    SELECT * INTO v_result
    FROM public.get_daily_minimum_availability(p_service_id, v_current_date);
    
    RETURN QUERY SELECT
      v_current_date,
      v_result.min_available,
      v_result.total_capacity,
      v_result.availability_percentage,
      v_result.min_slot_time;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_monthly_minimum_availability IS
  'Batch version of get_daily_minimum_availability for entire month.
  Returns daily minimum availability for calendar view.
  Use this instead of multiple individual calls for better performance.';

GRANT EXECUTE ON FUNCTION public.get_monthly_minimum_availability TO authenticated, anon;
