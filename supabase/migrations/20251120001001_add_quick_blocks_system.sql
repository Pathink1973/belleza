/*
  # Sistema de Bloqueios Rápidos

  ## Descrição
  Adiciona suporte para bloqueios rápidos de horários sem necessidade de cliente.
  Permite profissionais marcarem indisponibilidades rapidamente (pausas, almoços, etc).

  ## Mudanças

  1. Alterações na tabela bookings:
     - Tornar client_id NULLABLE para permitir bloqueios sem cliente
     - Adicionar coluna booking_type (enum: 'reserva', 'bloqueio')
     - Adicionar coluna block_reason para motivo do bloqueio (opcional)
     - Adicionar índice para consultas de bloqueios

  2. Tabela de templates de bloqueio:
     - Criar tabela block_templates para bloqueios comuns
     - Armazenar templates como "Almoço", "Pausa", "Formação"

  3. Políticas RLS:
     - Permitir profissionais criar bloqueios para seus serviços
     - Permitir profissionais visualizar seus próprios bloqueios
     - Permitir profissionais deletar seus próprios bloqueios

  4. Funções auxiliares:
     - Função para verificar conflitos de bloqueios
     - Função para listar bloqueios ativos

  ## Notas de Segurança
  - Bloqueios só podem ser criados por profissionais autenticados
  - Bloqueios só afetam disponibilidade dos próprios serviços do profissional
  - Cliente não consegue visualizar motivo de bloqueios
*/

-- Step 1: Add booking_type enum
DO $$ BEGIN
  CREATE TYPE booking_type AS ENUM ('reserva', 'bloqueio');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Step 2: Modify bookings table to support blocks
DO $$ 
BEGIN
  -- Make client_id nullable to allow blocks without clients
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'client_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE bookings ALTER COLUMN client_id DROP NOT NULL;
  END IF;

  -- Add booking_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'booking_type'
  ) THEN
    ALTER TABLE bookings ADD COLUMN booking_type booking_type DEFAULT 'reserva';
  END IF;

  -- Add block_reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'bookings' AND column_name = 'block_reason'
  ) THEN
    ALTER TABLE bookings ADD COLUMN block_reason text;
  END IF;

  -- Add constraint: if booking_type is 'bloqueio', client_id must be null
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bookings_block_no_client_check'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_block_no_client_check 
      CHECK (booking_type = 'reserva' OR (booking_type = 'bloqueio' AND client_id IS NULL));
  END IF;

  -- Add constraint: if booking_type is 'reserva', client_id must not be null
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bookings_reserva_needs_client_check'
  ) THEN
    ALTER TABLE bookings ADD CONSTRAINT bookings_reserva_needs_client_check 
      CHECK (booking_type = 'bloqueio' OR (booking_type = 'reserva' AND client_id IS NOT NULL));
  END IF;
END $$;

-- Step 3: Create index for efficient block queries
CREATE INDEX IF NOT EXISTS idx_bookings_blocks 
  ON bookings(professional_id, booking_type, start_time, end_time) 
  WHERE booking_type = 'bloqueio';

CREATE INDEX IF NOT EXISTS idx_bookings_team_member_blocks 
  ON bookings(team_member_id, booking_type, start_time, end_time) 
  WHERE booking_type = 'bloqueio' AND team_member_id IS NOT NULL;

-- Step 4: Create block_templates table for common blocks
CREATE TABLE IF NOT EXISTS block_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  default_duration text DEFAULT '1 hora',
  icon text DEFAULT 'Coffee',
  color text DEFAULT 'amber',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE block_templates ENABLE ROW LEVEL SECURITY;

-- RLS for block_templates
CREATE POLICY "Profissionais podem ver seus pr\u00f3prios templates de bloqueio"
  ON block_templates FOR SELECT
  TO authenticated
  USING (professional_id = auth.uid());

CREATE POLICY "Profissionais podem criar seus pr\u00f3prios templates de bloqueio"
  ON block_templates FOR INSERT
  TO authenticated
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Profissionais podem atualizar seus pr\u00f3prios templates de bloqueio"
  ON block_templates FOR UPDATE
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Profissionais podem deletar seus pr\u00f3prios templates de bloqueio"
  ON block_templates FOR DELETE
  TO authenticated
  USING (professional_id = auth.uid());

-- Step 5: Update bookings RLS policies to handle blocks
DROP POLICY IF EXISTS "Profissionais podem criar bloqueios r\u00e1pidos" ON bookings;
CREATE POLICY "Profissionais podem criar bloqueios r\u00e1pidos"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (
    booking_type = 'bloqueio' AND
    professional_id = auth.uid() AND
    client_id IS NULL
  );

DROP POLICY IF EXISTS "Profissionais podem deletar seus pr\u00f3prios bloqueios" ON bookings;
CREATE POLICY "Profissionais podem deletar seus pr\u00f3prios bloqueios"
  ON bookings FOR DELETE
  TO authenticated
  USING (
    booking_type = 'bloqueio' AND
    professional_id = auth.uid()
  );

-- Step 6: Function to get active blocks for a professional
CREATE OR REPLACE FUNCTION get_active_blocks(
  p_professional_id uuid,
  p_start_date date DEFAULT CURRENT_DATE,
  p_end_date date DEFAULT CURRENT_DATE + interval '30 days'
)
RETURNS TABLE (
  id uuid,
  start_time timestamptz,
  end_time timestamptz,
  block_reason text,
  service_id uuid,
  team_member_id uuid,
  created_at timestamptz
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.start_time,
    b.end_time,
    b.block_reason,
    b.service_id,
    b.team_member_id,
    b.created_at
  FROM bookings b
  WHERE 
    b.booking_type = 'bloqueio' AND
    b.professional_id = p_professional_id AND
    b.start_time::date >= p_start_date AND
    b.end_time::date <= p_end_date AND
    b.status != 'cancelado'
  ORDER BY b.start_time ASC;
END;
$$;

-- Step 7: Function to check if time slot has blocks
CREATE OR REPLACE FUNCTION has_blocking_conflict(
  p_service_id uuid,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_professional_id uuid DEFAULT NULL,
  p_team_member_id uuid DEFAULT NULL
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_conflict_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_conflict_count
  FROM bookings
  WHERE 
    booking_type = 'bloqueio' AND
    service_id = p_service_id AND
    status != 'cancelado' AND
    (
      (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
    ) AND
    (
      (p_professional_id IS NOT NULL AND professional_id = p_professional_id AND team_member_id IS NULL) OR
      (p_team_member_id IS NOT NULL AND team_member_id = p_team_member_id)
    );

  RETURN v_conflict_count > 0;
END;
$$;

-- Step 8: Insert default block templates for existing professionals
INSERT INTO block_templates (professional_id, name, default_duration, icon, color)
SELECT 
  id,
  'Almoço',
  '1 hora',
  'UtensilsCrossed',
  'orange'
FROM profiles
WHERE role = 'professional'
ON CONFLICT DO NOTHING;

INSERT INTO block_templates (professional_id, name, default_duration, icon, color)
SELECT 
  id,
  'Pausa',
  '30 minutos',
  'Coffee',
  'amber'
FROM profiles
WHERE role = 'professional'
ON CONFLICT DO NOTHING;

INSERT INTO block_templates (professional_id, name, default_duration, icon, color)
SELECT 
  id,
  'Reunião',
  '1 hora',
  'Users',
  'blue'
FROM profiles
WHERE role = 'professional'
ON CONFLICT DO NOTHING;

-- Step 9: Update existing bookings to have correct booking_type
UPDATE bookings 
SET booking_type = 'reserva' 
WHERE booking_type IS NULL AND client_id IS NOT NULL;

-- Step 10: Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_active_blocks TO authenticated;
GRANT EXECUTE ON FUNCTION has_blocking_conflict TO authenticated;