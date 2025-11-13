/*
  # Sistema de Bloqueio de Horários Específicos
  
  Adiciona funcionalidade para profissionais bloquearem horários específicos dentro de um dia,
  em vez de bloquear o dia inteiro. Isto permite maior flexibilidade na gestão de agenda.

  ## 1. Nova Tabela
    - `blocked_time_slots`
      - `id` (uuid, primary key)
      - `professional_id` (uuid, foreign key → profiles)
      - `date` (date, not null) - Data do bloqueio
      - `start_time` (time, not null) - Hora de início do bloqueio
      - `end_time` (time, not null) - Hora de fim do bloqueio
      - `reason` (text, nullable) - Motivo do bloqueio
      - `created_at` (timestamptz) - Data de criação
      - `updated_at` (timestamptz) - Data de atualização

  ## 2. Índices
    - Índice composto em (professional_id, date) para queries rápidas
    - Índice em (professional_id, date, start_time, end_time) para verificação de conflitos

  ## 3. Segurança (RLS)
    - Profissionais podem criar/visualizar/editar/eliminar apenas os seus próprios bloqueios
    - Clientes NÃO têm acesso a esta tabela (apenas profissionais)
    - Super admin tem acesso total

  ## 4. Validações
    - Constraint: end_time deve ser posterior a start_time
    - Constraint: não podem existir bloqueios sobrepostos para o mesmo profissional
    - Prevent para evitar bloqueios em datas passadas

  ## 5. Trigger de Atualização
    - Atualiza automaticamente updated_at em cada modificação
*/

-- Create blocked_time_slots table
CREATE TABLE IF NOT EXISTS blocked_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Validation: end_time must be after start_time
  CONSTRAINT valid_time_range CHECK (end_time > start_time),
  
  -- Validation: date cannot be in the past (only for new records)
  CONSTRAINT no_past_dates CHECK (date >= CURRENT_DATE)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocked_time_slots_professional_date 
  ON blocked_time_slots(professional_id, date);

CREATE INDEX IF NOT EXISTS idx_blocked_time_slots_time_range 
  ON blocked_time_slots(professional_id, date, start_time, end_time);

-- Enable RLS
ALTER TABLE blocked_time_slots ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Professionals can view their own blocked time slots
CREATE POLICY "Professionals can view own blocked time slots"
  ON blocked_time_slots
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = professional_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Professionals can create their own blocked time slots
CREATE POLICY "Professionals can create own blocked time slots"
  ON blocked_time_slots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = professional_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('professional', 'super_admin')
    )
  );

-- Professionals can update their own blocked time slots
CREATE POLICY "Professionals can update own blocked time slots"
  ON blocked_time_slots
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = professional_id)
  WITH CHECK (auth.uid() = professional_id);

-- Professionals can delete their own blocked time slots
CREATE POLICY "Professionals can delete own blocked time slots"
  ON blocked_time_slots
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = professional_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blocked_time_slots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_blocked_time_slots_updated_at ON blocked_time_slots;
CREATE TRIGGER trigger_update_blocked_time_slots_updated_at
  BEFORE UPDATE ON blocked_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION update_blocked_time_slots_updated_at();

-- Create function to check for overlapping blocked time slots
CREATE OR REPLACE FUNCTION check_blocked_time_slots_overlap()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if there's an overlapping time slot for the same professional on the same date
  IF EXISTS (
    SELECT 1 FROM blocked_time_slots
    WHERE professional_id = NEW.professional_id
    AND date = NEW.date
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND (
      -- New slot starts during existing slot
      (NEW.start_time >= start_time AND NEW.start_time < end_time) OR
      -- New slot ends during existing slot
      (NEW.end_time > start_time AND NEW.end_time <= end_time) OR
      -- New slot completely contains existing slot
      (NEW.start_time <= start_time AND NEW.end_time >= end_time)
    )
  ) THEN
    RAISE EXCEPTION 'Já existe um bloqueio sobreposto neste horário';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for overlap validation
DROP TRIGGER IF EXISTS trigger_check_blocked_time_slots_overlap ON blocked_time_slots;
CREATE TRIGGER trigger_check_blocked_time_slots_overlap
  BEFORE INSERT OR UPDATE ON blocked_time_slots
  FOR EACH ROW
  EXECUTE FUNCTION check_blocked_time_slots_overlap();

-- Add helpful comment to table
COMMENT ON TABLE blocked_time_slots IS 'Stores specific time slots that professionals have blocked within a day. This allows professionals to block specific hours instead of entire dates, providing more flexibility in schedule management.';
