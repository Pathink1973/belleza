/*
  # Corrigir Permissões de Eliminação de Reservas
  
  ## Problema
  Atualmente, apenas clientes podem eliminar reservas (e só se estiverem arquivadas e canceladas).
  Os profissionais não conseguem eliminar reservas da sua lista, mesmo sendo os proprietários do serviço.
  
  ## Solução
  1. Adicionar política que permite profissionais eliminarem as suas próprias reservas
  2. Permitir eliminação de qualquer reserva do profissional (não apenas arquivadas)
  3. Manter política existente para clientes
  
  ## Políticas Criadas
  - "Professionals can delete their own bookings" - Profissionais podem eliminar reservas dos seus serviços
  - Mantém política existente para clientes eliminarem reservas arquivadas
  
  ## Segurança
  - Profissionais só podem eliminar reservas associadas aos seus serviços
  - Clientes mantêm permissão limitada (apenas reservas arquivadas e canceladas)
  - Super admins têm acesso total via bypass RLS
*/

-- Drop existing delete policy if exists (to avoid conflicts)
DROP POLICY IF EXISTS "Clients can delete their archived bookings" ON bookings;
DROP POLICY IF EXISTS "Professionals can delete their own bookings" ON bookings;

-- Recreate client delete policy (unchanged)
CREATE POLICY "Clients can delete their archived bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (
    auth.uid() = client_id AND
    is_archived = true AND
    status = 'cancelado'
  );

-- Add new policy for professionals to delete their own bookings
CREATE POLICY "Professionals can delete their own bookings"
  ON bookings FOR DELETE
  TO authenticated
  USING (
    -- Professional owns the service OR is the assigned professional
    auth.uid() IN (
      SELECT s.professional_id 
      FROM services s 
      WHERE s.id = bookings.service_id
    )
    OR auth.uid() = professional_id
  );

COMMENT ON POLICY "Professionals can delete their own bookings" ON bookings IS
  'Permite profissionais eliminarem reservas associadas aos seus serviços. Útil para limpar dados antigos ou corrigir erros.';
