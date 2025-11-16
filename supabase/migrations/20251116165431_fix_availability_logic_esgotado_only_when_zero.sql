/*
  # Correção da Lógica de Disponibilidade - "Esgotado" Apenas Quando Capacidade = 0

  ## Problema Identificado
  O sistema estava marcando slots como "Esgotado" prematuramente, antes de todas as vagas
  serem ocupadas. Com 3 profissionais (1 principal + 2 membros), o sistema deveria:
  - Mostrar "3 vagas" quando ninguém está ocupado
  - Mostrar "2 vagas" após 1 reserva confirmada
  - Mostrar "1 vaga" após 2 reservas confirmadas
  - Mostrar "ESGOTADO" apenas após 3 reservas confirmadas (todas vagas ocupadas)

  ## Correções Implementadas
  1. Reforçar que `is_available = true` apenas quando `available_count > 0`
  2. Retornar `is_available = false` apenas quando `available_count = 0` (100% ocupado)
  3. Melhorar mensagens contextuais para indicar vagas parciais vs totalmente esgotado
  4. Garantir contagem precisa: `available_count = total_capacity - occupied_count`

  ## Lógica Correta
  - occupied_count: número de profissionais com reserva confirmada no slot
  - available_count: total_capacity - occupied_count
  - is_available: TRUE se available_count > 0, FALSE se available_count = 0
  - "Esgotado": aparece APENAS quando available_count = 0
*/

-- =====================================================
-- STEP 1: Recriar função com lógica corrigida
-- =====================================================

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
  v_available_count integer := 0;
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

  -- Build team data and calculate total capacity
  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    -- No team = 1 professional (owner only)
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
    -- Team exists = N professionals
    v_total_capacity := jsonb_array_length(v_team_jsonb);

    SELECT ARRAY_AGG(DISTINCT (elem->>'profile_id')::uuid)
    INTO v_professional_ids
    FROM jsonb_array_elements(v_team_jsonb) elem
    WHERE elem->>'profile_id' IS NOT NULL;
  END IF;

  -- Convert times to timestamptz
  v_slot_start := (p_date::text || ' ' || p_start_time::text)::timestamptz;
  v_slot_end := (p_date::text || ' ' || p_end_time::text)::timestamptz;

  -- CHECK 1: Blocked dates (entire day blocked for ALL professionals)
  SELECT 
    COUNT(*) = array_length(v_professional_ids, 1),
    (SELECT bd.reason FROM public.blocked_dates bd
     WHERE bd.professional_id = ANY(v_professional_ids) AND bd.date = p_date LIMIT 1)
  INTO v_is_day_blocked, v_blocked_reason
  FROM public.blocked_dates bd
  WHERE bd.professional_id = ANY(v_professional_ids) AND bd.date = p_date;

  -- Only block if ALL professionals are blocked for the day
  IF v_is_day_blocked AND array_length(v_professional_ids, 1) > 0 THEN
    RETURN QUERY SELECT
      false,
      v_total_capacity,
      v_total_capacity,  -- All are "occupied" by being blocked
      0,                  -- Zero available
      COALESCE(v_blocked_reason, 'Dia indisponível para todos os profissionais')::text,
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
      v_team_member_id := v_team_member->>'team_member_db_id';
      v_unique_id := v_team_member_id;
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

    -- Check blocked time slots for this specific professional
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

  -- Calculate available count
  v_available_count := v_total_capacity - v_occupied_count;

  -- CRITICAL FIX: Return is_available = TRUE if ANY slots remain (available_count > 0)
  -- Return is_available = FALSE only when ALL slots are occupied (available_count = 0)
  
  IF v_available_count = 0 THEN
    -- 100% occupied - ESGOTADO
    v_blocked_reason := CASE
      WHEN v_total_capacity = 1 THEN 'Profissional ocupado neste horário'
      ELSE format('Todos os %s profissionais estão ocupados neste horário', v_total_capacity)
    END;
    
    RETURN QUERY SELECT
      false,                    -- Not available
      v_total_capacity,
      v_occupied_count,         -- All occupied
      0,                        -- Zero available
      v_blocked_reason,
      'fully_booked'::text,
      '[]'::jsonb,              -- No one available
      v_occupied_profs;
  ELSE
    -- At least 1 slot available - DISPONÍVEL
    RETURN QUERY SELECT
      true,                     -- Available!
      v_total_capacity,
      v_occupied_count,
      v_available_count,        -- How many are still free
      NULL::text,               -- No blocking reason
      NULL::text,               -- No blocking factor
      v_available_profs,        -- Who is available
      v_occupied_profs;         -- Who is occupied
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_unified_slot_availability IS
  'CORRIGIDO: Retorna is_available=true quando available_count > 0, e is_available=false apenas quando available_count = 0 (totalmente esgotado). Cada reserva confirmada ocupa 1 profissional.';

GRANT EXECUTE ON FUNCTION public.get_unified_slot_availability TO authenticated, anon;
