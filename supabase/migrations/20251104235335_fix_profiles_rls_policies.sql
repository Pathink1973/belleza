/*
  # Corrigir Políticas RLS para Perfis de Utilizadores
  
  ## Resumo
  Esta migração adiciona políticas RLS que permitem aos utilizadores 
  autenticados visualizarem e atualizarem os seus próprios perfis.
  
  ## Alterações
  
  1. Novas Políticas:
     - Utilizadores podem ver todos os perfis públicos (SELECT)
     - Utilizadores podem atualizar o seu próprio perfil (UPDATE)
     - Utilizadores podem inserir o seu próprio perfil (INSERT)
  
  ## Notas Importantes
  - Estas políticas são essenciais para o funcionamento normal da aplicação
  - Os utilizadores só podem modificar os seus próprios dados
  - A visualização de perfis é pública para permitir ver estabelecimentos
*/

-- Remover políticas existentes se existirem (para evitar duplicação)
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Política para permitir que todos os utilizadores autenticados vejam perfis
CREATE POLICY "Users can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para permitir que utilizadores atualizem o seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Política para permitir que utilizadores insiram o seu próprio perfil
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Mensagem de confirmação
DO $$
BEGIN
  RAISE NOTICE '✓ Políticas RLS adicionadas com sucesso!';
  RAISE NOTICE '✓ Utilizadores podem agora atualizar os seus perfis';
  RAISE NOTICE '✓ Campo business_phone será guardado corretamente';
END $$;