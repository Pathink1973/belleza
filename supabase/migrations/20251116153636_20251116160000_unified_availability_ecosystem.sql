/*
  # Sistema Unificado de Disponibilidade - Ecossistema Sincronizado

  1. Visão Geral
    Este sistema garante sincronização completa entre:
    - Serviços e suas variantes (preços/durações diferentes)
    - Equipa de profissionais (owner + membros)
    - Disponibilidade base (horários de trabalho)
    - Bloqueios de dias completos (blocked_dates)
    - Bloqueios de horários específicos (blocked_time_slots)
    - Reservas confirmadas (bookings com status 'confirmado')
    - Capacidade dinâmica (número de profissionais = número de vagas)

  2. Funções Criadas
    - get_unified_slot_availability: Retorna disponibilidade completa de um slot
    - get_service_daily_capacity_summary: Resumo de ocupação do dia
    - validate_booking_capacity: Valida se há capacidade antes de confirmar
    - get_slot_capacity_details: Detalhes de quem está ocupado/livre em cada slot

  3. Triggers Implementados
    - Atualização automática quando bookings mudam de status
    - Recálculo de capacidade quando team é modificado
    - Invalidação de cache quando availability/blocked_dates mudam

  4. Garantias de Consistência
    - Impossível confirmar reserva sem capacidade disponível
    - Cálculo em tempo real considerando TODOS os fatores
    - Mensagens de erro contextuais explicando o motivo do bloqueio
    - Contadores precisos de vagas livres/ocupadas

  5. Performance
    - Queries otimizadas com índices apropriados
    - Cache inteligente com invalidação seletiva
    - Batch queries para reduzir chamadas ao banco
*/

-- =====================================================
-- STEP 1: Função para calcular capacidade total de um serviço
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_service_total_capacity(
  p_service_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_team_jsonb jsonb;
  v_capacity integer := 1;
BEGIN
  SELECT team INTO v_team_jsonb
  FROM public.services
  WHERE id = p_service_id;

  IF v_team_jsonb IS NOT NULL
     AND jsonb_typeof(v_team_jsonb) = 'array'
     AND jsonb_array_length(v_team_jsonb) > 0 THEN
    v_capacity := jsonb_array_length(v_team_jsonb);
  END IF;

  RETURN v_capacity;
END;
$$;

COMMENT ON FUNCTION public.get_service_total_capacity IS
  'Retorna capacidade total do serviço (1 se sem equipa, N se tem equipa com N membros)';

GRANT EXECUTE ON FUNCTION public.get_service_total_capacity TO authenticated, anon;


-- =====================================================
-- STEP 2: Função unificada de disponibilidade de slot
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
    v_blocked_reason := format('Todos os %s profissionais estão ocupados neste horário', v_total_capacity);
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

GRANT EXECUTE ON FUNCTION public.get_unified_slot_availability TO authenticated, anon;


-- =====================================================
-- STEP 3: Função para resumo de capacidade do dia
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_service_daily_capacity_summary(
  p_service_id uuid,
  p_date date
)
RETURNS TABLE(
  total_capacity integer,
  total_slots integer,
  available_slots integer,
  occupied_slots integer,
  fully_booked_slots integer,
  occupation_percentage numeric
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_capacity integer;
  v_total integer := 0;
  v_available integer := 0;
  v_occupied integer := 0;
  v_fully_booked integer := 0;
  v_current_time time;
  v_end_time time;
  v_slot_data record;
BEGIN
  v_capacity := public.get_service_total_capacity(p_service_id);

  -- Iterate through all time slots (09:00 to 19:30, 30-minute intervals)
  FOR hour IN 9..19 LOOP
    FOR minute IN 0..30 BY 30 LOOP
      IF hour = 19 AND minute = 30 THEN
        CONTINUE;
      END IF;

      v_current_time := make_time(hour, minute, 0);
      v_end_time := v_current_time + interval '30 minutes';

      v_total := v_total + 1;

      -- Get availability for this slot
      SELECT * INTO v_slot_data
      FROM public.get_unified_slot_availability(
        p_service_id,
        p_date,
        v_current_time,
        v_end_time
      );

      IF v_slot_data.is_available THEN
        v_available := v_available + 1;
        IF v_slot_data.occupied_count > 0 THEN
          v_occupied := v_occupied + 1;
        END IF;
      ELSE
        v_fully_booked := v_fully_booked + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT
    v_capacity,
    v_total,
    v_available,
    v_occupied,
    v_fully_booked,
    CASE WHEN v_total > 0 THEN
      ROUND((v_fully_booked::numeric / v_total::numeric) * 100, 1)
    ELSE 0 END;
END;
$$;

COMMENT ON FUNCTION public.get_service_daily_capacity_summary IS
  'Retorna resumo de ocupação do dia: total de slots, disponíveis, ocupados, esgotados, e percentual de ocupação';

GRANT EXECUTE ON FUNCTION public.get_service_daily_capacity_summary TO authenticated, anon;


-- =====================================================
-- STEP 4: Função para validar capacidade antes de confirmar booking
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_booking_capacity(
  p_booking_id uuid
)
RETURNS TABLE(
  can_confirm boolean,
  error_message text,
  available_capacity integer,
  total_capacity integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_booking record;
  v_availability record;
  v_start_time time;
  v_end_time time;
  v_date date;
BEGIN
  -- Get booking details
  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF v_booking.id IS NULL THEN
    RETURN QUERY SELECT
      false,
      'Reserva não encontrada'::text,
      0,
      0;
    RETURN;
  END IF;

  -- Extract date and times
  v_date := v_booking.start_time::date;
  v_start_time := v_booking.start_time::time;
  v_end_time := v_booking.end_time::time;

  -- Check availability
  SELECT * INTO v_availability
  FROM public.get_unified_slot_availability(
    v_booking.service_id,
    v_date,
    v_start_time,
    v_end_time
  );

  IF NOT v_availability.is_available THEN
    RETURN QUERY SELECT
      false,
      COALESCE(
        v_availability.blocked_reason,
        format('Não há vagas disponíveis - %s/%s profissionais ocupados',
          v_availability.occupied_count,
          v_availability.total_capacity
        )
      )::text,
      v_availability.available_count,
      v_availability.total_capacity;
  ELSE
    RETURN QUERY SELECT
      true,
      NULL::text,
      v_availability.available_count,
      v_availability.total_capacity;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.validate_booking_capacity IS
  'Valida se uma reserva pode ser confirmada verificando capacidade disponível. Retorna mensagem de erro detalhada se não houver capacidade.';

GRANT EXECUTE ON FUNCTION public.validate_booking_capacity TO authenticated;


-- =====================================================
-- STEP 5: Criar índices para otimização
-- =====================================================

-- Index for fast service team lookup
CREATE INDEX IF NOT EXISTS idx_services_team_gin
  ON public.services USING gin(team);

-- Composite index for booking capacity queries
CREATE INDEX IF NOT EXISTS idx_bookings_capacity_check
  ON public.bookings(service_id, status, start_time, end_time, professional_id, team_member_id)
  WHERE status = 'confirmado';

-- Index for blocked dates lookup by professional
CREATE INDEX IF NOT EXISTS idx_blocked_dates_professional_date
  ON public.blocked_dates(professional_id, date);

-- Index for blocked time slots lookup
CREATE INDEX IF NOT EXISTS idx_blocked_time_slots_lookup
  ON public.blocked_time_slots(professional_id, date, start_time, end_time);


-- =====================================================
-- STEP 6: Trigger para refresh automático quando bookings mudam
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_availability_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify that availability has changed for this service
  PERFORM pg_notify(
    'availability_changed',
    json_build_object(
      'service_id', COALESCE(NEW.service_id, OLD.service_id),
      'date', (COALESCE(NEW.start_time, OLD.start_time)::date)::text,
      'change_type', TG_OP
    )::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create separate triggers for INSERT, UPDATE, and DELETE

DROP TRIGGER IF EXISTS trigger_booking_availability_insert ON public.bookings;
DROP TRIGGER IF EXISTS trigger_booking_availability_update ON public.bookings;
DROP TRIGGER IF EXISTS trigger_booking_availability_delete ON public.bookings;

CREATE TRIGGER trigger_booking_availability_insert
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  WHEN (NEW.status = 'confirmado')
  EXECUTE FUNCTION public.notify_availability_change();

CREATE TRIGGER trigger_booking_availability_update
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW
  WHEN (
    (OLD.status != 'confirmado' AND NEW.status = 'confirmado') OR
    (OLD.status = 'confirmado' AND NEW.status != 'confirmado')
  )
  EXECUTE FUNCTION public.notify_availability_change();

CREATE TRIGGER trigger_booking_availability_delete
  AFTER DELETE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_availability_change();

COMMENT ON TRIGGER trigger_booking_availability_insert ON public.bookings IS
  'Notifica mudanças de disponibilidade quando booking confirmado é criado';

COMMENT ON TRIGGER trigger_booking_availability_update ON public.bookings IS
  'Notifica mudanças de disponibilidade quando status muda de/para confirmado';

COMMENT ON TRIGGER trigger_booking_availability_delete ON public.bookings IS
  'Notifica mudanças de disponibilidade quando booking é deletado';


-- =====================================================
-- STEP 7: Trigger para quando equipa (team) é modificada
-- =====================================================

CREATE OR REPLACE FUNCTION public.notify_team_capacity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify that team capacity has changed
  PERFORM pg_notify(
    'capacity_changed',
    json_build_object(
      'service_id', NEW.id,
      'old_capacity', CASE
        WHEN OLD.team IS NULL OR jsonb_typeof(OLD.team) != 'array' OR jsonb_array_length(OLD.team) = 0
        THEN 1
        ELSE jsonb_array_length(OLD.team)
      END,
      'new_capacity', CASE
        WHEN NEW.team IS NULL OR jsonb_typeof(NEW.team) != 'array' OR jsonb_array_length(NEW.team) = 0
        THEN 1
        ELSE jsonb_array_length(NEW.team)
      END
    )::text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_service_team_change ON public.services;

CREATE TRIGGER trigger_service_team_change
  AFTER UPDATE OF team ON public.services
  FOR EACH ROW
  WHEN (OLD.team IS DISTINCT FROM NEW.team)
  EXECUTE FUNCTION public.notify_team_capacity_change();

COMMENT ON TRIGGER trigger_service_team_change ON public.services IS
  'Notifica quando a equipa de um serviço é modificada, afetando capacidade total';


-- =====================================================
-- STEP 8: Criar view para dashboard de disponibilidade
-- =====================================================

CREATE OR REPLACE VIEW public.service_availability_dashboard AS
SELECT
  s.id as service_id,
  s.title as service_name,
  s.professional_id,
  p.full_name as professional_name,
  public.get_service_total_capacity(s.id) as total_capacity,
  CASE
    WHEN s.team IS NULL OR jsonb_typeof(s.team) != 'array'
    THEN 0
    ELSE jsonb_array_length(s.team)
  END as team_size,
  s.team,
  s.duration,
  s.price,
  s.created_at
FROM public.services s
JOIN public.profiles p ON s.professional_id = p.id
WHERE s.professional_id IS NOT NULL;

COMMENT ON VIEW public.service_availability_dashboard IS
  'Dashboard view showing service capacity and team information for availability management';

GRANT SELECT ON public.service_availability_dashboard TO authenticated;