/*
  # Optimize Availability Checking with Batch Query
  
  1. Problem
    - Current implementation calls `get_available_professionals_for_slot` for each time slot (~22 calls per day)
    - This creates unnecessary database load and slows down the booking form
    
  2. Solution
    - Create a new function that returns availability for ALL time slots in a single query
    - Generate 30-minute intervals from 09:00 to 19:30 automatically
    - Check each professional's availability for all slots at once
    
  3. Benefits
    - Reduces database calls from ~22 to 1 per booking form load
    - Faster page load times
    - Lower database load
    - Same accuracy as individual queries
    
  4. Implementation
    - New function: `get_day_availability_for_service`
    - Returns JSONB array of time slots with available professionals
    - Uses the same logic as `get_available_professionals_for_slot`
*/

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
  -- Get service data
  SELECT professional_id, team 
  INTO v_service_owner_id, v_team_jsonb
  FROM public.services
  WHERE id = p_service_id;
  
  -- Calculate total capacity
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
        
        -- Check for conflicts
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
        jsonb_array_length(v_available_profs) > 0;
    END LOOP;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.get_day_availability_for_service IS 
  'Returns availability for all time slots in a day for a service in a single query. Optimized for booking form loading.';

GRANT EXECUTE ON FUNCTION public.get_day_availability_for_service TO authenticated, anon;
