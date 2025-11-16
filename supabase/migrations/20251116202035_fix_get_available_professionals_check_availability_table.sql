/*
  # CORREÇÃO CRÍTICA: Verificar Tabela Availability em get_available_professionals_for_slot
  
  ## PROBLEMA IDENTIFICADO
  A função get_available_professionals_for_slot estava a retornar profissionais como disponíveis
  SEM VERIFICAR se eles tinham o horário configurado na tabela availability!
  
  Estava apenas a verificar:
  1. ✅ Conflitos de reservas (bookings)
  2. ✅ Bloqueios de horário (blocked_time_slots)
  3. ❌ NÃO verificava se o horário está nos slots de trabalho configurados (availability)!
  
  ## RESULTADO
  TODOS os horários apareciam como "ESGOTADO" (vermelho) porque a função não encontrava
  profissionais disponíveis (pois não verificava a tabela availability).
  
  ## SOLUÇÃO
  Adicionar verificação OBRIGATÓRIA da tabela availability para cada profissional.
  Um profissional SÓ é considerado disponível se:
  1. TEM o horário configurado na tabela availability para aquele dia da semana
  2. NÃO tem reserva confirmada (bookings)
  3. NÃO tem bloqueio de horário (blocked_time_slots)
*/

CREATE OR REPLACE FUNCTION public.get_available_professionals_for_slot(
  p_service_id uuid,
  p_date date,
  p_start_time time,
  p_end_time time
)
RETURNS TABLE(
  unique_id text,
  profile_id uuid,
  team_member_id text,
  full_name text,
  avatar_url text,
  is_primary boolean,
  total_capacity integer,
  booked_count integer,
  available_count integer
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_slot_start timestamptz;
  v_slot_end timestamptz;
  v_service_owner_id uuid;
  v_team_jsonb jsonb;
  v_team_member jsonb;
  v_total_capacity integer := 0;
  v_available_count integer := 0;
  v_booked_count integer := 0;
  v_has_conflict boolean;
  v_unique_id text;
  v_profile_id uuid;
  v_team_member_id text;
  v_full_name text;
  v_avatar_url text;
  v_is_primary boolean;
  v_day_of_week integer;
  v_has_availability_slot boolean;
BEGIN
  v_slot_start := (p_date::text || ' ' || p_start_time::text)::timestamptz;
  v_slot_end := (p_date::text || ' ' || p_end_time::text)::timestamptz;
  
  -- Get day of week (0 = Sunday, 1 = Monday, etc.)
  v_day_of_week := EXTRACT(DOW FROM p_date)::integer;

  SELECT professional_id, team 
  INTO v_service_owner_id, v_team_jsonb
  FROM public.services
  WHERE id = p_service_id;

  IF v_team_jsonb IS NULL OR jsonb_typeof(v_team_jsonb) != 'array' OR jsonb_array_length(v_team_jsonb) = 0 THEN
    RETURN;
  END IF;

  v_total_capacity := jsonb_array_length(v_team_jsonb);

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

    -- CRITICAL: Check if professional has this time slot configured in availability table
    IF v_is_primary AND v_profile_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.availability a
        WHERE a.professional_id = v_profile_id
          AND a.day_of_week = v_day_of_week
          AND a.is_available = true
          AND a.start_time <= p_start_time
          AND a.end_time >= p_end_time
      ) INTO v_has_availability_slot;
      
      -- If professional doesn't work at this time, mark as unavailable
      IF NOT v_has_availability_slot THEN
        v_booked_count := v_booked_count + 1;
        CONTINUE;
      END IF;
    ELSE
      -- For non-primary team members, assume they follow service owner's availability
      -- (since they don't have their own availability table entries)
      SELECT EXISTS (
        SELECT 1 FROM public.availability a
        WHERE a.professional_id = v_service_owner_id
          AND a.day_of_week = v_day_of_week
          AND a.is_available = true
          AND a.start_time <= p_start_time
          AND a.end_time >= p_end_time
      ) INTO v_has_availability_slot;
      
      IF NOT v_has_availability_slot THEN
        v_booked_count := v_booked_count + 1;
        CONTINUE;
      END IF;
    END IF;

    -- Check for booking conflicts
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
          (NOT v_is_primary AND v_team_member_id IS NOT NULL AND b.team_member_id = v_team_member_id)
        )
    );

    -- Check for blocked time slots
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

    IF NOT v_has_conflict THEN
      v_available_count := v_available_count + 1;

      RETURN QUERY SELECT
        v_unique_id,
        v_profile_id,
        v_team_member_id,
        v_full_name,
        v_avatar_url,
        v_is_primary,
        v_total_capacity,
        v_booked_count,
        v_available_count;
    ELSE
      v_booked_count := v_booked_count + 1;
    END IF;
  END LOOP;

END;
$$;

COMMENT ON FUNCTION public.get_available_professionals_for_slot IS
  'Returns list of available professionals for a time slot. NOW CORRECTLY CHECKS availability table for working hours!';
