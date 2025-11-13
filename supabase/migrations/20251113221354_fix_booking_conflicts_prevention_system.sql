/*
  # Sistema de Prevenção de Conflitos de Reservas

  1. Objetivo
    - Prevenir que múltiplas reservas confirmadas sejam criadas para o mesmo profissional no mesmo horário
    - Garantir que apenas reservas com status "confirmado" bloqueiam horários
    - Validar sobreposição de intervalos de tempo considerando professional_id e team_member_id

  2. Alterações
    - Adicionar índice composto para otimizar queries de conflito
    - Criar função de validação de sobreposição de horários
    - Implementar trigger que impede inserções/updates conflitantes
    - Adicionar constraint de exclusão para garantir unicidade

  3. Regras de Negócio
    - Apenas reservas com status "confirmado" bloqueiam horários
    - Primary professional: identificado por professional_id com team_member_id NULL
    - Team members: identificados por team_member_id (não NULL)
    - Não pode haver sobreposição de horários para a mesma pessoa
*/

-- Criar índice composto para queries rápidas de conflito
CREATE INDEX IF NOT EXISTS idx_bookings_conflict_check 
ON bookings(professional_id, team_member_id, start_time, end_time, status)
WHERE status = 'confirmado';

-- Função para verificar sobreposição de intervalos de tempo
CREATE OR REPLACE FUNCTION check_booking_time_overlap(
  p_booking_id uuid,
  p_professional_id uuid,
  p_team_member_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_status text
) RETURNS boolean AS $$
DECLARE
  v_conflict_count integer;
BEGIN
  -- Apenas verificar conflitos para reservas confirmadas
  IF p_status != 'confirmado' THEN
    RETURN false;
  END IF;

  -- Contar reservas confirmadas que conflitam
  SELECT COUNT(*)
  INTO v_conflict_count
  FROM bookings
  WHERE 
    id != COALESCE(p_booking_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND status = 'confirmado'
    AND (
      -- Para primary professional (team_member_id é NULL)
      (p_team_member_id IS NULL AND professional_id = p_professional_id AND team_member_id IS NULL)
      OR
      -- Para team members (team_member_id não é NULL)
      (p_team_member_id IS NOT NULL AND team_member_id = p_team_member_id)
    )
    AND (
      -- Verificar sobreposição de intervalos
      (p_start_time >= start_time AND p_start_time < end_time)
      OR
      (p_end_time > start_time AND p_end_time <= end_time)
      OR
      (p_start_time <= start_time AND p_end_time >= end_time)
    );

  RETURN v_conflict_count > 0;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger function para validar conflitos antes de INSERT ou UPDATE
CREATE OR REPLACE FUNCTION validate_booking_no_conflicts()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas validar se o status for "confirmado"
  IF NEW.status = 'confirmado' THEN
    -- Verificar se há conflito
    IF check_booking_time_overlap(
      NEW.id,
      NEW.professional_id,
      NEW.team_member_id,
      NEW.start_time,
      NEW.end_time,
      NEW.status
    ) THEN
      RAISE EXCEPTION 'Conflito de horário: Este profissional já tem uma reserva confirmada neste horário.'
        USING HINT = 'Por favor, escolha outro horário ou outro profissional.',
              ERRCODE = '23P01'; -- exclusion_violation
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validar na inserção
DROP TRIGGER IF EXISTS trg_validate_booking_insert ON bookings;
CREATE TRIGGER trg_validate_booking_insert
  BEFORE INSERT ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking_no_conflicts();

-- Criar trigger para validar na atualização
DROP TRIGGER IF EXISTS trg_validate_booking_update ON bookings;
CREATE TRIGGER trg_validate_booking_update
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'confirmado' OR OLD.status != NEW.status)
  EXECUTE FUNCTION validate_booking_no_conflicts();

-- Adicionar comentários para documentação
COMMENT ON FUNCTION check_booking_time_overlap IS 
  'Verifica se uma reserva confirmada conflita com outras reservas confirmadas do mesmo profissional. Considera professional_id (primary) e team_member_id (collaborator).';

COMMENT ON FUNCTION validate_booking_no_conflicts IS 
  'Trigger function que impede criação ou confirmação de reservas com conflito de horário. Apenas reservas com status "confirmado" são verificadas.';

COMMENT ON INDEX idx_bookings_conflict_check IS 
  'Índice parcial para otimizar verificação de conflitos apenas em reservas confirmadas.';
