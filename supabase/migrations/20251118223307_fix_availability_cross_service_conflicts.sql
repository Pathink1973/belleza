/*
  # Fix Availability System - Cross-Service Conflict Detection
  
  ## Critical Problem Fixed
  The availability counting system was only checking conflicts within the same service_id.
  This caused incorrect availability counts because:
  - Primary professionals can work on multiple services but can only be in one place at a time
  - Team members (collaborators) cannot have parallel bookings across different services
  - When a professional/collaborator has a confirmed booking in Service A, they should be 
    marked as unavailable in Service B for the same time slot
  
  ## Changes Made
  1. **Removed service_id filter from conflict detection queries**
     - Now checks ALL confirmed bookings for the professional/collaborator
     - Prevents double-booking across different services
     - Ensures accurate "vagas disponíveis" count
  
  2. **Added comments explaining the business logic**
     - Primary professionals are physical people who cannot be in two places
     - Collaborators (team_members) also cannot have overlapping bookings
  
  3. **Maintained status filter (confirmado only)**
     - Only confirmed bookings block availability
     - Pending, cancelled, and completed bookings don't affect current availability
  
  ## Impact
  - ✅ Badge now shows correct count (e.g., 0 vagas when all professionals are booked)
  - ✅ Prevents overbooking across services
  - ✅ Professional busy in Service A is now unavailable in Service B
  - ✅ Collaborators cannot have overlapping bookings in different services
  
  ## Example Scenario
  Before: Professional has booking in "Corte de Cabelo" 16:30-17:00
          System shows "1 vaga" available in "Barba" 16:30-17:00 ❌
  
  After:  Professional has booking in "Corte de Cabelo" 16:30-17:00
          System shows "0 vagas" in "Barba" 16:30-17:00 ✅
          Badge color: RED (esgotado), calendar blocks this specific time slot
*/

-- =====================================================
-- RECREATE: get_professionals_availability_for_slot with cross-service conflict detection
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

    -- Check if owner has conflict IN ANY SERVICE (not just this one)
    -- Professional is a physical person and cannot be in two places at the same time
    SELECT EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.status = 'confirmado'
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

      -- Check for conflicts across ALL SERVICES (removed service_id filter)
      IF v_is_primary THEN
        -- Primary professional: check if they have ANY confirmed booking at this time
        -- They are a physical person and cannot work on multiple services simultaneously
        SELECT EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.status = 'confirmado'
            AND b.start_time < v_slot_end
            AND b.end_time > v_slot_start
            AND b.professional_id = v_profile_id
            AND b.team_member_id IS NULL
        ) INTO v_has_conflict;
      ELSE
        -- Team member (collaborator): check if they have ANY confirmed booking at this time
        -- Collaborators also cannot be in two places at the same time
        IF v_team_member_id IS NOT NULL THEN
          SELECT EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.status = 'confirmado'
              AND b.start_time < v_slot_end
              AND b.end_time > v_slot_start
              AND b.team_member_id = v_team_member_id
          ) INTO v_has_conflict;
        ELSE
          -- If team_member_id is NULL, mark as unavailable (data inconsistency)
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
  'Returns detailed professional availability for a specific time slot. 
  NOW CORRECTLY CHECKS CONFLICTS ACROSS ALL SERVICES - professionals and collaborators 
  cannot be in two places at the same time, regardless of which service they are working on.';

GRANT EXECUTE ON FUNCTION public.get_professionals_availability_for_slot TO authenticated, anon;
