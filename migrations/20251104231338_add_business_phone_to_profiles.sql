/*
  # Adicionar Campo de Telefone aos Perfis
  
  ## Resumo
  Esta migração adiciona o campo de telefone de contacto do estabelecimento 
  à tabela profiles, permitindo que os cartões de serviço mostrem 
  informações de contacto completas.
  
  ## Alterações
  
  1. Novo Campo na Tabela `profiles`:
     - `business_phone` (text): Número de telefone do estabelecimento
  
  2. Índices:
     - Criar índice para melhor performance em pesquisas por telefone
  
  ## Notas Importantes
  - Campo é opcional para permitir migração gradual
  - Validação de formato pode ser implementada na aplicação
  - Compatível com números nacionais e internacionais
*/

-- Adicionar campo de telefone do estabelecimento
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'business_phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_phone text;
  END IF;
END $$;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS profiles_business_phone_idx ON profiles(business_phone);

-- Adicionar comentário para documentação
COMMENT ON COLUMN profiles.business_phone IS 'Número de telefone de contacto do estabelecimento (formato nacional ou internacional)';

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✓ Campo business_phone adicionado com sucesso!';
  RAISE NOTICE '✓ Profissionais agora podem adicionar telefone de contacto';
  RAISE NOTICE '✓ Campo aparecerá nos cartões de serviço';
END $$;