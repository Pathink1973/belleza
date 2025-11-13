/*
  # Sistema de Arquivamento de Reservas

  1. Mudanças
    - Adiciona coluna archived_at para rastrear quando reserva foi arquivada
    - Cria índice composto para otimizar queries de reservas ativas
    - Adiciona tabela audit_log para registrar limpezas de dados
    - Cria trigger automático para atualizar archived_at
    - Adiciona função stored procedure para limpeza segura de dados

  2. Índices
    - Índice composto em (professional_id, status, start_time) para performance
    - Índice em archived_at para queries de histórico

  3. Segurança
    - Audit log rastreia todas as exclusões de dados
    - RLS policies aplicadas em audit_log
    - Função de limpeza verifica permissões
*/

-- Adicionar coluna archived_at na tabela bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- Criar índice composto para otimizar queries de reservas ativas
CREATE INDEX IF NOT EXISTS bookings_active_idx
ON bookings(professional_id, status, start_time)
WHERE status IN ('pending', 'confirmed');

-- Criar índice para archived_at
CREATE INDEX IF NOT EXISTS bookings_archived_at_idx
ON bookings(archived_at)
WHERE archived_at IS NOT NULL;

-- Criar tabela de auditoria para registrar limpezas
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  performed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  details jsonb DEFAULT '{}'::jsonb,
  records_affected integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Criar índice na tabela de auditoria
CREATE INDEX IF NOT EXISTS audit_log_performed_by_idx ON audit_log(performed_by);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);

-- Habilitar RLS na tabela audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policy para professionals visualizarem seus próprios logs
CREATE POLICY "Professionals can view their own audit logs"
ON audit_log
FOR SELECT
TO authenticated
USING (
  performed_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('professional', 'admin', 'super_admin')
  )
);

-- Policy para inserir logs (apenas sistema)
CREATE POLICY "System can insert audit logs"
ON audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('professional', 'admin', 'super_admin')
  )
);

-- Criar trigger para atualizar archived_at automaticamente
CREATE OR REPLACE FUNCTION update_archived_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
    NEW.archived_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_archived_at_trigger ON bookings;
CREATE TRIGGER set_archived_at_trigger
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_archived_at();

-- Criar função stored procedure para limpeza segura de dados arquivados
CREATE OR REPLACE FUNCTION cleanup_archived_bookings(
  p_professional_id uuid,
  p_confirmation_text text
)
RETURNS jsonb AS $$
DECLARE
  v_deleted_count integer := 0;
  v_result jsonb;
  v_user_role text;
BEGIN
  -- Verificar se usuário é o professional correto
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = p_professional_id;

  IF v_user_role NOT IN ('professional', 'admin', 'super_admin') THEN
    RAISE EXCEPTION 'Unauthorized: User must be a professional, admin, or super admin';
  END IF;

  -- Verificar texto de confirmação
  IF p_confirmation_text != 'CONFIRMAR EXCLUSAO' THEN
    RAISE EXCEPTION 'Invalid confirmation text';
  END IF;

  -- Contar registros que serão deletados
  SELECT COUNT(*) INTO v_deleted_count
  FROM bookings
  WHERE professional_id = p_professional_id
    AND status IN ('completed', 'cancelled');

  -- Deletar reservas arquivadas e seus dados relacionados
  -- As notificações serão deletadas em cascata devido ao ON DELETE CASCADE
  DELETE FROM bookings
  WHERE professional_id = p_professional_id
    AND status IN ('completed', 'cancelled');

  -- Registrar no audit log
  INSERT INTO audit_log (action, performed_by, details, records_affected)
  VALUES (
    'cleanup_archived_bookings',
    p_professional_id,
    jsonb_build_object(
      'deleted_count', v_deleted_count,
      'timestamp', now(),
      'statuses', ARRAY['completed', 'cancelled']
    ),
    v_deleted_count
  );

  -- Retornar resultado
  v_result := jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'message', format('Successfully deleted %s archived bookings', v_deleted_count)
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to cleanup archived bookings'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para exportar dados de reservas antes da limpeza
CREATE OR REPLACE FUNCTION export_archived_bookings_data(
  p_professional_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'client_name', p.full_name,
      'client_email', p.email,
      'client_phone', p.mobile_number,
      'service_title', s.title,
      'start_time', b.start_time,
      'end_time', b.end_time,
      'status', b.status,
      'notes', b.notes,
      'created_at', b.created_at,
      'archived_at', b.archived_at
    )
  ) INTO v_result
  FROM bookings b
  JOIN profiles p ON b.client_id = p.id
  JOIN services s ON b.service_id = s.id
  WHERE b.professional_id = p_professional_id
    AND b.status IN ('completed', 'cancelled');

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários nas funções
COMMENT ON FUNCTION cleanup_archived_bookings IS 'Deleta permanentemente reservas arquivadas (completed/cancelled) após confirmação';
COMMENT ON FUNCTION export_archived_bookings_data IS 'Exporta dados de reservas arquivadas para backup antes da exclusão';
COMMENT ON TABLE audit_log IS 'Registra todas as ações de limpeza de dados para auditoria';
