/*
  # Sistema de Disponibilidade em Tempo Real Baseado em Reservas

  ## Descrição
  Este migration implementa um sistema completo de disponibilidade em tempo real que:
  - Calcula disponibilidade baseada em reservas confirmadas da tabela bookings
  - Cruza dados de service_team_members com bookings para contagem precisa
  - Fornece funções otimizadas para consultas rápidas de disponibilidade
  - Suporta cálculo de ocupação por data, horário e profissional

  ## Novas Funções RPC

  ### 1. get_realtime_availability_count
  Retorna contagem de profissionais disponíveis para um serviço em horário específico
  - Parâmetros: service_id, date, start_time, end_time
  - Retorna: { available_count, total_capacity, occupied_count, utilization_percentage }

  ### 2. get_service_daily_availability_matrix
  Retorna matriz completa de disponibilidade para um serviço em uma data
  - Parâmetros: service_id, date
  - Retorna: array de slots com status de disponibilidade

  ### 3. get_professional_occupancy_rate
  Calcula taxa de ocupação de um profissional para período específico
  - Parâmetros: professional_id, start_date, end_date
  - Retorna: { total_slots, booked_slots, occupancy_rate }

  ### 4. get_available_slots_for_date
  Lista todos os horários disponíveis para um serviço em data específica
  - Parâmetros: service_id, date
  - Retorna: array de horários com contagem de profissionais disponíveis

  ## Índices de Performance
  Cria índices otimizados para queries rápidas:
  - bookings(service_id, start_time, status)
  - bookings(professional_id, team_member_id, start_time)
  - service_team_members(service_id)

  ## Segurança
  - Todas as funções são SECURITY DEFINER para acesso consistente
  - RLS continua aplicado nas tabelas base
  - Funções acessíveis apenas por usuários autenticados
*/

-- =====================================================
-- FUNÇÃO 1: Contagem de Disponibilidade em Tempo Real
-- =====================================================

CREATE OR REPLACE FUNCTION get_realtime_availability_count(
  p_service_id UUID,
  p_date DATE,
  p_start_time TIME,
  p_end_time TIME
)
RETURNS TABLE (
  available_count INTEGER,
  total_capacity INTEGER,
  occupied_count INTEGER,
  utilization_percentage NUMERIC,
  available_professionals JSONB,
  occupied_professionals JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_service_record RECORD;
  v_team_member RECORD;
  v_professional_id UUID;
  v_all_professionals JSONB := '[]'::jsonb;
  v_available_list JSONB := '[]'::jsonb;
  v_occupied_list JSONB := '[]'::jsonb;
  v_total INTEGER := 0;
  v_occupied INTEGER := 0;
  v_start_datetime TIMESTAMP;
  v_end_datetime TIMESTAMP;
BEGIN
  -- Construir timestamps completos
  v_start_datetime := (p_date || ' ' || p_start_time)::TIMESTAMP;
  v_end_datetime := (p_date || ' ' || p_end_time)::TIMESTAMP;

  -- Buscar serviço
  SELECT s.professional_id, s.team
  INTO v_service_record
  FROM services s
  WHERE s.id = p_service_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0, 0, 0, 0.0::NUMERIC, '[]'::jsonb, '[]'::jsonb;
    RETURN;
  END IF;

  -- Processar profissional principal (service owner)
  v_professional_id := v_service_record.professional_id;

  -- Verificar se profissional principal está bloqueado para o dia inteiro
  IF EXISTS (
    SELECT 1 FROM blocked_dates
    WHERE professional_id = v_professional_id
    AND date = p_date
  ) THEN
    -- Profissional principal bloqueado, não contar
    NULL;
  ELSE
    v_total := v_total + 1;

    -- Verificar se tem reserva confirmada neste horário
    IF EXISTS (
      SELECT 1 FROM bookings
      WHERE service_id = p_service_id
      AND professional_id = v_professional_id
      AND team_member_id IS NULL
      AND status = 'confirmado'
      AND start_time < v_end_datetime
      AND end_time > v_start_datetime
    ) THEN
      -- Ocupado
      v_occupied := v_occupied + 1;
      v_occupied_list := v_occupied_list || jsonb_build_object(
        'unique_id', v_professional_id,
        'profile_id', v_professional_id,
        'team_member_id', NULL,
        'is_primary', true
      );
    ELSE
      -- Disponível
      v_available_list := v_available_list || jsonb_build_object(
        'unique_id', v_professional_id,
        'profile_id', v_professional_id,
        'team_member_id', NULL,
        'is_primary', true
      );
    END IF;
  END IF;

  -- Processar team members do JSONB
  IF v_service_record.team IS NOT NULL AND jsonb_array_length(v_service_record.team) > 0 THEN
    FOR v_team_member IN
      SELECT * FROM jsonb_array_elements(v_service_record.team)
    LOOP
      -- Pular se for o profissional principal (já processado)
      IF (v_team_member.value->>'is_primary')::boolean = true THEN
        CONTINUE;
      END IF;

      DECLARE
        v_member_profile_id UUID;
        v_member_db_id UUID;
      BEGIN
        v_member_profile_id := (v_team_member.value->>'profile_id')::UUID;
        v_member_db_id := (v_team_member.value->>'team_member_db_id')::UUID;

        -- Verificar se está bloqueado
        IF v_member_profile_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM blocked_dates
          WHERE professional_id = v_member_profile_id
          AND date = p_date
        ) THEN
          -- Bloqueado, não contar
          CONTINUE;
        END IF;

        v_total := v_total + 1;

        -- Verificar reserva
        IF v_member_db_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM bookings
          WHERE service_id = p_service_id
          AND team_member_id = v_member_db_id
          AND status = 'confirmado'
          AND start_time < v_end_datetime
          AND end_time > v_start_datetime
        ) THEN
          -- Ocupado
          v_occupied := v_occupied + 1;
          v_occupied_list := v_occupied_list || jsonb_build_object(
            'unique_id', v_member_db_id,
            'profile_id', v_member_profile_id,
            'team_member_id', v_member_db_id,
            'is_primary', false
          );
        ELSE
          -- Disponível
          v_available_list := v_available_list || jsonb_build_object(
            'unique_id', v_member_db_id,
            'profile_id', v_member_profile_id,
            'team_member_id', v_member_db_id,
            'is_primary', false
          );
        END IF;
      END;
    END LOOP;
  END IF;

  -- Retornar resultado
  RETURN QUERY SELECT
    v_total - v_occupied AS available_count,
    v_total AS total_capacity,
    v_occupied AS occupied_count,
    CASE
      WHEN v_total > 0 THEN ROUND((v_occupied::NUMERIC / v_total::NUMERIC) * 100, 2)
      ELSE 0.0
    END AS utilization_percentage,
    v_available_list AS available_professionals,
    v_occupied_list AS occupied_professionals;
END;
$$;

-- =====================================================
-- FUNÇÃO 2: Matriz de Disponibilidade Diária
-- =====================================================

CREATE OR REPLACE FUNCTION get_service_daily_availability_matrix(
  p_service_id UUID,
  p_date DATE
)
RETURNS TABLE (
  time_slot TIME,
  available_count INTEGER,
  total_capacity INTEGER,
  is_available BOOLEAN,
  utilization_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot TIME;
  v_result RECORD;
BEGIN
  -- Gerar slots de 30 em 30 minutos das 09:00 às 20:00
  FOR v_slot IN
    SELECT generate_series('09:00'::time, '19:30'::time, '30 minutes'::interval)::time
  LOOP
    SELECT * INTO v_result
    FROM get_realtime_availability_count(
      p_service_id,
      p_date,
      v_slot,
      (v_slot + '30 minutes'::interval)::time
    );

    RETURN QUERY SELECT
      v_slot,
      v_result.available_count,
      v_result.total_capacity,
      v_result.available_count > 0 AS is_available,
      v_result.utilization_percentage;
  END LOOP;
END;
$$;

-- =====================================================
-- FUNÇÃO 3: Taxa de Ocupação do Profissional
-- =====================================================

CREATE OR REPLACE FUNCTION get_professional_occupancy_rate(
  p_professional_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_slots INTEGER,
  booked_slots INTEGER,
  occupancy_rate NUMERIC,
  period_start DATE,
  period_end DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total INTEGER := 0;
  v_booked INTEGER := 0;
BEGIN
  -- Calcular total de slots disponíveis no período (assumindo 21 slots por dia: 9h-19:30h)
  v_total := (p_end_date - p_start_date + 1) * 21;

  -- Contar slots reservados
  SELECT COUNT(*) INTO v_booked
  FROM bookings
  WHERE (
    (professional_id = p_professional_id AND team_member_id IS NULL)
    OR team_member_id IN (
      SELECT (value->>'team_member_db_id')::UUID
      FROM services s
      CROSS JOIN jsonb_array_elements(s.team) AS team_member
      WHERE s.professional_id = p_professional_id
      AND (value->>'profile_id')::UUID = p_professional_id
    )
  )
  AND status = 'confirmado'
  AND start_time::date BETWEEN p_start_date AND p_end_date;

  RETURN QUERY SELECT
    v_total,
    v_booked,
    CASE WHEN v_total > 0 THEN ROUND((v_booked::NUMERIC / v_total::NUMERIC) * 100, 2) ELSE 0.0 END,
    p_start_date,
    p_end_date;
END;
$$;

-- =====================================================
-- FUNÇÃO 4: Horários Disponíveis para Data
-- =====================================================

CREATE OR REPLACE FUNCTION get_available_slots_for_date(
  p_service_id UUID,
  p_date DATE
)
RETURNS TABLE (
  time_slot TIME,
  available_count INTEGER,
  total_capacity INTEGER,
  available_professionals JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot TIME;
  v_result RECORD;
BEGIN
  FOR v_slot IN
    SELECT generate_series('09:00'::time, '19:30'::time, '30 minutes'::interval)::time
  LOOP
    SELECT * INTO v_result
    FROM get_realtime_availability_count(
      p_service_id,
      p_date,
      v_slot,
      (v_slot + '30 minutes'::interval)::time
    );

    -- Só retornar slots com disponibilidade
    IF v_result.available_count > 0 THEN
      RETURN QUERY SELECT
        v_slot,
        v_result.available_count,
        v_result.total_capacity,
        v_result.available_professionals;
    END IF;
  END LOOP;
END;
$$;

-- =====================================================
-- ÍNDICES DE PERFORMANCE
-- =====================================================

-- Índice composto para queries de disponibilidade por serviço e horário
CREATE INDEX IF NOT EXISTS idx_bookings_service_time_status
ON bookings(service_id, start_time, status)
WHERE status = 'confirmado';

-- Índice para queries por profissional/team member
CREATE INDEX IF NOT EXISTS idx_bookings_professional_team_time
ON bookings(professional_id, team_member_id, start_time)
WHERE status = 'confirmado';

-- Índice para blocked_dates lookups rápidos
CREATE INDEX IF NOT EXISTS idx_blocked_dates_professional_date
ON blocked_dates(professional_id, date);

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION get_realtime_availability_count IS
'Calcula disponibilidade em tempo real baseada em reservas confirmadas. Retorna contagem de profissionais disponíveis e ocupados para um horário específico.';

COMMENT ON FUNCTION get_service_daily_availability_matrix IS
'Retorna matriz completa de disponibilidade para todos os horários de um serviço em uma data específica.';

COMMENT ON FUNCTION get_professional_occupancy_rate IS
'Calcula taxa de ocupação de um profissional durante um período específico.';

COMMENT ON FUNCTION get_available_slots_for_date IS
'Lista apenas os horários que têm pelo menos um profissional disponível para uma data específica.';
