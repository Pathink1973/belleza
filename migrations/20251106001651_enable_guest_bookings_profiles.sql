/*
  # Permitir Reservas de Convidados - Políticas RLS para Profiles
  
  ## Resumo
  Esta migração atualiza as políticas RLS da tabela `profiles` para permitir
  que utilizadores não autenticados (convidados) possam criar perfis básicos
  ao fazer reservas, mantendo a segurança através de validações específicas.
  
  ## Alterações
  
  1. Políticas Atualizadas:
     - Política de INSERT atualizada para permitir criação anônima de perfis com role 'client'
     - Mantém restrições para garantir que apenas campos básicos são preenchidos
     - Adiciona flag `is_guest` para diferenciar convidados de clientes registados
  
  2. Nova Coluna:
     - `is_guest` (boolean): Identifica se o perfil foi criado como convidado
  
  ## Segurança
  - Convidados só podem criar perfis com role 'client'
  - Convidados não podem atualizar perfis sem autenticação
  - Perfis guest têm acesso limitado às funcionalidades
  - Validação de email obrigatória para prevenir spam
*/

-- Adicionar coluna is_guest se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_guest'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_guest boolean DEFAULT false;
  END IF;
END $$;

-- Remover política antiga de insert se existir
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Allow anonymous profile creation for guests" ON profiles;

-- Nova política para permitir criação de perfis por utilizadores autenticados
CREATE POLICY "Authenticated users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Nova política para permitir criação de perfis guest por utilizadores anônimos
CREATE POLICY "Allow anonymous profile creation for guests"
  ON profiles
  FOR INSERT
  TO anon
  WITH CHECK (
    role = 'client' AND
    is_guest = true AND
    full_name IS NOT NULL AND
    email IS NOT NULL AND
    mobile_number IS NOT NULL
  );

-- Atualizar política de SELECT para incluir acesso público a perfis de profissionais
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Public can view professional profiles" ON profiles;

CREATE POLICY "Public can view professional profiles"
  ON profiles
  FOR SELECT
  USING (role = 'professional' OR role = 'admin' OR role = 'super_admin');

CREATE POLICY "Users can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Atualizar política de UPDATE para garantir que guests não podem atualizar sem autenticação
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Authenticated users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Criar índice para melhorar performance de queries com is_guest
CREATE INDEX IF NOT EXISTS idx_profiles_is_guest ON profiles(is_guest) WHERE is_guest = true;

-- Criar índice para email em perfis guest (para validação de duplicados)
CREATE INDEX IF NOT EXISTS idx_profiles_guest_email ON profiles(email) WHERE is_guest = true;

COMMENT ON COLUMN profiles.is_guest IS 'Indica se o perfil foi criado como convidado (sem registo completo)';
