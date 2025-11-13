/*
  # Tradução dos Status de Bookings para Português

  Esta migration converte todos os valores de status na tabela bookings de inglês para português.

  ## Mudanças

  1. **Conversão de Valores de Status**
     - pending → pendente
     - confirmed → confirmado
     - completed → concluído
     - cancelled → cancelado

  2. **Atualização de Constraints**
     - Remove o constraint CHECK antigo que aceita valores em inglês
     - Adiciona novo constraint CHECK que aceita apenas valores em português

  3. **Atualização de Dados Existentes**
     - Converte todos os registros existentes para os novos valores em português
     - Garante que nenhum dado seja perdido durante a conversão

  ## Notas Importantes

  - Esta migration é compatível com o sistema de i18n já implementado na aplicação
  - Todos os registros existentes são preservados com seus valores convertidos
  - O histórico desta mudança fica registrado no sistema de migrations
*/

-- ============================================================================
-- PASSO 1: Remover o constraint CHECK existente
-- ============================================================================

DO $$
BEGIN
  -- Tentar remover o constraint se ele existir
  -- O nome do constraint pode variar, então tentamos os nomes comuns
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check1;
  ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check2;
EXCEPTION
  WHEN undefined_object THEN
    -- Ignorar se o constraint não existir
    NULL;
END $$;

-- ============================================================================
-- PASSO 2: Atualizar todos os registros existentes
-- ============================================================================

-- Converter os valores de status de inglês para português
UPDATE bookings
SET status = CASE
  WHEN status = 'pending' THEN 'pendente'
  WHEN status = 'confirmed' THEN 'confirmado'
  WHEN status = 'completed' THEN 'concluído'
  WHEN status = 'cancelled' THEN 'cancelado'
  ELSE status -- Manter valor atual se não for reconhecido
END
WHERE status IN ('pending', 'confirmed', 'completed', 'cancelled');

-- ============================================================================
-- PASSO 3: Adicionar novo constraint CHECK com valores em português
-- ============================================================================

ALTER TABLE bookings
ADD CONSTRAINT bookings_status_check
CHECK (status IN ('pendente', 'confirmado', 'concluído', 'cancelado'));

-- ============================================================================
-- PASSO 4: Atualizar o valor padrão da coluna status
-- ============================================================================

ALTER TABLE bookings
ALTER COLUMN status SET DEFAULT 'pendente';

-- ============================================================================
-- VERIFICAÇÕES DE INTEGRIDADE
-- ============================================================================

-- Verificar se todos os registros foram convertidos corretamente
DO $$
DECLARE
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_count
  FROM bookings
  WHERE status NOT IN ('pendente', 'confirmado', 'concluído', 'cancelado');

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'Existem % registros com status inválidos após a conversão', invalid_count;
  END IF;

  RAISE NOTICE 'Conversão de status concluída com sucesso! Todos os registros estão válidos.';
END $$;
