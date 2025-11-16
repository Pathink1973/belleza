/*
  # Corrigir Verificação de Horários de Trabalho
  
  ## PROBLEMA CRÍTICO IDENTIFICADO
  A função get_professionals_availability_for_slot não estava a verificar
  se o horário solicitado está nos slots de disponibilidade (availability table).
  
  Estava apenas a verificar:
  1. Se o dia está bloqueado (blocked_dates)
  2. Se há conflitos de reservas (bookings)
  
  MAS NÃO VERIFICAVA:
  3. Se o horário está configurado como disponível na tabela availability!
  
  ## Solução
  Adicionar verificação OBRIGATÓRIA da tabela availability ANTES de considerar
  um profissional como disponível.
  
  ## Comportamento Correto
  Um slot só deve aparecer como disponível se:
  1. O dia NÃO está bloqueado (blocked_dates)
  2. O horário ESTÁ configurado na tabela availability para aquele dia da semana
  3. O profissional NÃO tem reserva confirmada nesse horário
*/

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
  v_utilization_pct numeric;
  v_day_of_week integer;
  v_has_availability_slot boolean;
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

  -- Get day of week (0 = Sunday, 1 = Monday, etc.)
  v_day_of_week := EXTRACT(DOW FROM p_date)::integer;

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

    -- CRITICAL: Check if professional has availability slot configured for this time
    SELECT EXISTS (
      SELECT 1 FROM public.availability a
      WHERE a.professional_id = v_service.professional_id
        AND a.day_of_week = v_day_of_week
        AND a.is_available = true
        AND a.start_time <= p_start_time
        AND a.end_time >= p_end_time
    ) INTO v_has_availability_slot;

    IF NOT v_has_availability_slot THEN
      -- Professional doesn't work at this time - mark as unavailable
      RETURN QUERY SELECT 
        0, 0, 0, false, 
        '[]'::jsonb, '[]'::jsonb,
        'Horário fora do expediente'::text;
      RETURN;
    END IF;

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

      -- CRITICAL: Check if this professional has availability slot configured
      SELECT EXISTS (
        SELECT 1 FROM public.availability a
        WHERE a.professional_id = v_profile_id
          AND a.day_of_week = v_day_of_week
          AND a.is_available = true
          AND a.start_time <= p_start_time
          AND a.end_time >= p_end_time
      ) INTO v_has_availability_slot;

      IF NOT v_has_availability_slot THEN
        -- This professional doesn't work at this time - mark as occupied/unavailable
        v_professional_data := jsonb_build_object(
          'id', COALESCE(v_team_member_id, v_profile_id),
          'name', COALESCE(v_name, 'Profissional'),
          'photo_url', v_photo_url,
          'is_primary', v_is_primary,
          'team_member_id', v_team_member_id
        );
        v_occupied_pros := v_occupied_pros || v_professional_data;
        v_occupied_count := v_occupied_count + 1;
        CONTINUE;
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

  -- Calculate utilization percentage
  IF v_total_capacity > 0 THEN
    v_utilization_pct := (v_occupied_count::numeric / v_total_capacity::numeric) * 100;
  ELSE
    v_utilization_pct := 0;
  END IF;

  -- Determine blocked_reason based on actual availability and utilization
  RETURN QUERY SELECT
    v_total_capacity,
    v_available_count,
    v_occupied_count,
    v_available_count > 0,
    v_available_pros,
    v_occupied_pros,
    CASE 
      WHEN v_available_count = 0 AND v_occupied_count = 0 THEN
        'Horário fora do expediente'
      WHEN v_available_count = 0 THEN 
        format('Esgotado - %s de %s ocupados', v_occupied_count, v_total_capacity)
      WHEN v_utilization_pct >= 75 THEN 
        format('%s de %s disponíveis - Reserve já!', v_available_count, v_total_capacity)
      WHEN v_utilization_pct >= 50 THEN 
        format('%s de %s disponíveis', v_available_count, v_total_capacity)
      ELSE 
        format('%s profissional%s disponível%s', 
          v_available_count, 
          CASE WHEN v_available_count > 1 THEN 'is' ELSE '' END,
          CASE WHEN v_available_count > 1 THEN 'eis' ELSE '' END
        )
    END;
END;
$$;

COMMENT ON FUNCTION public.get_professionals_availability_for_slot IS
  'Returns detailed professional list with availability status. Now correctly checks availability table for working hours.';
