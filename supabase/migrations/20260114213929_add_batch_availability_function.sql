/*
  # Add Batch Availability Function

  1. New Functions
    - `get_all_slots_with_professionals` - Returns all time slots for a day with available professionals
      - Single database call instead of 22+ individual calls
      - Significantly improves booking form performance
      - Returns complete slot information including available professionals for each

  2. Performance Improvements
    - Eliminates N+1 query problem in booking form
    - Reduces database round trips from ~22 to 1
    - Uses set-returning function for efficient data transfer

  3. Notes
    - Considers blocked dates, blocked time slots, and existing confirmed bookings
    - Returns team members with their unique IDs for proper assignment
*/

CREATE OR REPLACE FUNCTION get_all_slots_with_professionals(
  p_service_id uuid,
  p_date date
)
RETURNS TABLE (
  time_slot text,
  end_time text,
  total_capacity integer,
  available_count integer,
  is_available boolean,
  is_blocked boolean,
  block_reason text,
  available_professionals jsonb
) AS $$
DECLARE
  v_service_professional_id uuid;
  v_team jsonb;
  v_total_capacity integer;
  v_slot_time time;
  v_slot_end time;
  v_hour integer;
  v_minute integer;
  v_day_of_week integer;
BEGIN
  SELECT professional_id, team
  INTO v_service_professional_id, v_team
  FROM services
  WHERE id = p_service_id;

  IF v_service_professional_id IS NULL THEN
    RETURN;
  END IF;

  IF v_team IS NOT NULL AND jsonb_array_length(v_team) > 0 THEN
    v_total_capacity := jsonb_array_length(v_team);
  ELSE
    v_total_capacity := 1;
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date)::integer;

  FOR v_hour IN 9..19 LOOP
    FOR v_minute IN 0..30 BY 30 LOOP
      v_slot_time := make_time(v_hour, v_minute, 0);
      
      IF v_minute = 30 THEN
        v_slot_end := make_time(v_hour + 1, 0, 0);
      ELSE
        v_slot_end := make_time(v_hour, 30, 0);
      END IF;

      time_slot := to_char(v_slot_time, 'HH24:MI');
      end_time := to_char(v_slot_end, 'HH24:MI');
      total_capacity := v_total_capacity;
      
      SELECT 
        b.block_reason IS NOT NULL,
        COALESCE(b.block_reason, '')
      INTO is_blocked, block_reason
      FROM bookings b
      WHERE b.service_id = p_service_id
        AND b.booking_type = 'bloqueio'
        AND b.status = 'confirmado'
        AND DATE(b.start_time) = p_date
        AND b.start_time::time <= v_slot_time
        AND b.end_time::time > v_slot_time
      LIMIT 1;

      is_blocked := COALESCE(is_blocked, false);
      block_reason := COALESCE(block_reason, '');

      IF is_blocked THEN
        available_count := 0;
        is_available := false;
        available_professionals := '[]'::jsonb;
      ELSE
        WITH booked_members AS (
          SELECT 
            COALESCE(bk.team_member_id::text, bk.professional_id::text) as member_id
          FROM bookings bk
          WHERE bk.service_id = p_service_id
            AND bk.status = 'confirmado'
            AND bk.booking_type = 'reserva'
            AND DATE(bk.start_time) = p_date
            AND bk.start_time::time < v_slot_end
            AND bk.end_time::time > v_slot_time
        ),
        team_members AS (
          SELECT 
            tm->>'unique_id' as unique_id,
            tm->>'name' as name,
            (tm->>'is_primary')::boolean as is_primary,
            tm->>'profile_id' as profile_id,
            tm->>'team_member_id' as team_member_id
          FROM jsonb_array_elements(COALESCE(v_team, '[{"unique_id": "' || v_service_professional_id || '", "is_primary": true, "profile_id": "' || v_service_professional_id || '"}]'::jsonb)) as tm
        ),
        available_members AS (
          SELECT 
            tm.unique_id,
            tm.name,
            tm.is_primary,
            tm.profile_id,
            tm.team_member_id
          FROM team_members tm
          WHERE tm.unique_id NOT IN (SELECT member_id FROM booked_members)
        )
        SELECT 
          COUNT(*)::integer,
          jsonb_agg(jsonb_build_object(
            'unique_id', am.unique_id,
            'name', am.name,
            'is_primary', am.is_primary,
            'profile_id', am.profile_id,
            'team_member_id', am.team_member_id
          ))
        INTO available_count, available_professionals
        FROM available_members am;

        available_count := COALESCE(available_count, 0);
        available_professionals := COALESCE(available_professionals, '[]'::jsonb);
        is_available := available_count > 0;
      END IF;

      RETURN NEXT;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;