/*
  # Adicionar Campos de Estabelecimento aos Perfis
  
  ## Resumo
  Esta migracao adiciona campos para permitir que profissionais tenham informacoes 
  do seu estabelecimento separadas dos seus dados pessoais, transformando a plataforma
  numa verdadeira marketplace.
  
  ## Alteracoes
  
  1. Novos Campos na Tabela `profiles`:
     - `business_name` (text): Nome do estabelecimento/salao
     - `business_description` (text): Descricao do estabelecimento
     - `business_address` (text): Morada do estabelecimento
     - `business_hours` (jsonb): Horario de funcionamento
  
  2. Alteracoes no Campo `role`:
     - Manter roles: 'client', 'professional', 'admin'
     - 'admin' = super admin da plataforma (nao aparece como dono de servicos)
     - 'professional' = dono de estabelecimento (aparece nos cards de servicos)
  
  ## Notas Importantes
  - Campos business_* sao opcionais para permitir migracao gradual
  - Se business_name for NULL, usa-se full_name como fallback
  - RLS continua desabilitado para desenvolvimento
*/

-- Adicionar novos campos para informacoes do estabelecimento
DO $$
BEGIN
  -- business_name: Nome do estabelecimento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'business_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_name text;
  END IF;

  -- business_description: Descricao do estabelecimento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'business_description'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_description text;
  END IF;

  -- business_address: Morada do estabelecimento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'business_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_address text;
  END IF;

  -- business_hours: Horario de funcionamento (formato JSON)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'business_hours'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_hours jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Criar indices para melhor performance
CREATE INDEX IF NOT EXISTS profiles_business_name_idx ON profiles(business_name);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON profiles(role);

-- Adicionar comentarios para documentacao
COMMENT ON COLUMN profiles.business_name IS 'Nome do estabelecimento/salao (usado nos cards publicos)';
COMMENT ON COLUMN profiles.business_description IS 'Descricao do estabelecimento para exibicao publica';
COMMENT ON COLUMN profiles.business_address IS 'Morada fisica do estabelecimento';
COMMENT ON COLUMN profiles.business_hours IS 'Horario de funcionamento em formato JSON. Exemplo: {"monday": "09:00-18:00", "tuesday": "09:00-18:00"}';

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✓ Campos de estabelecimento adicionados com sucesso!';
  RAISE NOTICE '✓ Profissionais agora podem ter nome e descricao de estabelecimento';
  RAISE NOTICE '✓ Admin continua separado de professional';
END $$;