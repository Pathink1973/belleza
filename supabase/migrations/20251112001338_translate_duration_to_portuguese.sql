/*
  # Traduzir durações de "minutes" para "minutos"
  
  1. Alterações
    - Atualizar todos os valores de duração na tabela `service_variants` que contenham " minutes" para " minutos"
    
  2. Motivo
    - Garantir que toda a interface da aplicação apareça em português para os usuários
    - Padronizar o formato de armazenamento de durações no banco de dados
    - Melhorar a experiência do usuário com textos consistentes em português
    
  3. Notas Importantes
    - A tabela `services` usa tipo `interval` do PostgreSQL que armazena no formato HH:MM:SS, não precisa de alteração
    - A tabela `service_variants` usa tipo `text` e contém strings como "60 minutes" que precisam ser traduzidas
    - Esta migração é segura e não causa perda de dados
    - Apenas substitui a palavra "minutes" por "minutos" nas strings de duração
    - Mantém a compatibilidade com o código que já reconhece ambos os formatos
    - Registros que já usam "minutos" não serão afetados
*/

-- Atualizar durações na tabela service_variants
UPDATE service_variants
SET duration = REPLACE(duration, ' minutes', ' minutos')
WHERE duration LIKE '% minutes';

-- Verificar quantos registros foram atualizados
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM service_variants
  WHERE duration LIKE '% minutos';
  
  RAISE NOTICE 'Total de variantes de serviço com duração em português: %', updated_count;
END $$;
