/*
  # Corrige tipo de team_member_id na função de disponibilidade
  
  1. Problema
    - A coluna team_member_id na tabela bookings é UUID
    - A função get_unified_slot_availability estava a usar TEXT
    - Causava erro: operator does not exist: uuid = text
  
  2. Solução
    - Alterar v_team_member_id de text para uuid
    - Ajustar a comparação para usar UUID em vez de text
*/

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
  v_team_member_id uuid;
  v_unique_id text;
  v_has_conflict boolean;
  v_full_name text;
  v_avatar_url text;
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
      'service_not_found'::text,
      '[]'::jsonb, '[]'::jsonb;
    RETURN;
  END IF;

  -- Build team data and calculate capacity
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
      'day_blocked'::text,
      '[]'::jsonb,
      v_team_jsonb;
    RETURN;
  END IF;

  -- CHECK 2: Process each professional to see if available or occupied
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
      -- Convert team_member_db_id from text to uuid
      BEGIN
        v_team_member_id := (v_team_member->>'team_member_db_id')::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_team_member_id := NULL;
      END;
      v_unique_id := v_team_member_id::text;
    END IF;

    IF v_unique_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Check for booking conflicts (only 'confirmado' status blocks)
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

  -- Determine blocking factor and reason
  IF v_occupied_count >= v_total_capacity THEN
    v_blocked_reason := format('Todos os %s profissionais estão ocupados', v_total_capacity);
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
  'Função unificada que verifica disponibilidade considerando TODO o ecossistema: blocked_dates, blocked_time_slots, bookings confirmados, e capacidade da equipa';