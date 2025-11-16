/*
  # Corrigir Política RLS de INSERT em Bookings para Profissionais
  
  ## Resumo
  Esta migração corrige o erro "new row violates row-level security policy" 
  permitindo que profissionais criem bookings para os seus clientes.
  
  ## Problema Identificado
  As políticas atuais de INSERT na tabela bookings são muito restritivas:
  - "Authenticated clients can create bookings": Só permite se auth.uid() = client_id
  - "Anonymous guests can create bookings": Só para utilizadores anon
  
  Faltava uma política que permite profissionais criarem bookings para os seus clientes!
  
  ## Solução
  1. Adicionar política que permite profissionais criarem bookings
  2. Validar que o serviço pertence ao profissional
  3. Manter todas as validações de segurança existentes
  
  ## Políticas Criadas
  - Profissionais podem criar bookings para serviços que eles possuem
  - Clientes podem criar bookings para si mesmos
  - Convidados anônimos podem criar bookings com perfil guest válido
  
  ## Segurança
  - Profissional só pode criar booking se professional_id = auth.uid()
  - Cliente só pode criar booking se client_id = auth.uid()
  - Todas as outras validações mantidas
*/

-- Remove políticas antigas para recriar corretamente
DROP POLICY IF EXISTS "Authenticated clients can create bookings" ON bookings;
DROP POLICY IF EXISTS "Anonymous guests can create bookings" ON bookings;
DROP POLICY IF EXISTS "Professionals can create bookings for their services" ON bookings;

-- Política 1: Clientes autenticados podem criar bookings para si mesmos
CREATE POLICY "Clients can create their own bookings"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Deve ser um cliente
    auth.uid() = client_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role = 'client'
    )
  );

-- Política 2: Profissionais podem criar bookings para os seus serviços
CREATE POLICY "Professionals can create bookings for their services"
  ON bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- O profissional deve ser o dono do serviço
    auth.uid() = professional_id AND
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_id
      AND services.professional_id = auth.uid()
    ) AND
    -- O profissional deve ter role 'professional', 'admin' ou 'super_admin'
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role IN ('professional', 'admin', 'super_admin')
    )
  );

-- Política 3: Convidados anônimos podem criar bookings com perfil guest válido
CREATE POLICY "Anonymous guests can create bookings"
  ON bookings
  FOR INSERT
  TO anon
  WITH CHECK (
    -- Deve existir um perfil guest válido
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = client_id 
      AND role = 'client'
      AND is_guest = true
      AND email IS NOT NULL
      AND mobile_number IS NOT NULL
    ) AND
    -- Status inicial deve ser 'pendente'
    status IN ('pendente', 'pending')
  );

-- Adicionar comentários para documentação
COMMENT ON POLICY "Professionals can create bookings for their services" ON bookings IS 
  'Permite que profissionais criem bookings para os seus próprios serviços, validando ownership do serviço';

COMMENT ON POLICY "Clients can create their own bookings" ON bookings IS 
  'Permite que clientes autenticados criem bookings para si mesmos';

COMMENT ON POLICY "Anonymous guests can create bookings" ON bookings IS 
  'Permite que convidados não autenticados criem bookings com perfil guest válido';
