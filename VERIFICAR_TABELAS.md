# Verificar Configuração das Tabelas

## Problema Atual

O erro "Erro ao guardar serviço" indica que algo não está configurado corretamente no Supabase.

## Passo 1: Verificar se as Tabelas Existem

Acesse o SQL Editor do Supabase:
```
https://0ec90b57d6e95fcbda19832f.supabase.co/project/_/sql
```

Execute este comando para verificar as tabelas:

```sql
-- Verificar quais tabelas existem
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Você deve ver estas tabelas:**
- availability
- blocked_dates
- bookings
- calendar_notes
- client_notes
- clients
- profiles
- reviews
- services

## Passo 2: Verificar a Estrutura da Tabela Services

```sql
-- Verificar colunas da tabela services
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'services'
ORDER BY ordinal_position;
```

**Colunas esperadas:**
- id (uuid)
- professional_id (uuid)
- title (text)
- description (text)
- price (numeric)
- duration (interval)
- image_url (text)
- whatsapp_number (text)
- category (text)
- team (jsonb)
- created_at (timestamptz)
- updated_at (timestamptz)

## Passo 3: Verificar Row Level Security (RLS)

```sql
-- Verificar status do RLS
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'services';
```

**Resultado esperado:**
- rowsecurity = **false** (RLS desabilitado para desenvolvimento)

Se mostrar `true`, execute:

```sql
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
```

## Passo 4: Testar INSERT Manual

```sql
-- Tentar inserir um serviço manualmente
INSERT INTO services (
  professional_id,
  title,
  description,
  price,
  duration,
  whatsapp_number,
  category
) VALUES (
  gen_random_uuid(), -- Temporário para teste
  'Teste de Serviço',
  'Descrição do teste',
  50.00,
  '60 minutes',
  '+351912345678',
  'Teste'
);

-- Verificar se foi inserido
SELECT * FROM services ORDER BY created_at DESC LIMIT 1;
```

Se este INSERT funcionar, o problema está na aplicação.
Se falhar, o problema está no banco de dados.

## Passo 5: Se as Tabelas NÃO Existem

Execute o schema completo:

1. Abra o arquivo `SCHEMA_COMPLETO.sql`
2. Copie **TODO** o conteúdo
3. Cole no SQL Editor
4. Clique em "Run"
5. Aguarde a confirmação

## Passo 6: Verificar Permissões

```sql
-- Verificar permissões na tabela services
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'services'
AND grantee IN ('anon', 'authenticated');
```

**Deve mostrar:**
- anon: SELECT, INSERT, UPDATE, DELETE
- authenticated: SELECT, INSERT, UPDATE, DELETE

Se não tiver todas as permissões:

```sql
GRANT ALL ON services TO anon, authenticated;
```

## Passo 7: Limpar Console do Navegador

Após verificar o banco de dados:

1. Abra o console do navegador (F12)
2. Clique em "Console"
3. Tente criar um serviço novamente
4. Veja as mensagens de erro detalhadas:
   - "User ID: ..."
   - "Form Data: ..."
   - "Service Data to save: ..."
   - "Supabase Response: ..."

## Erros Comuns e Soluções

### Erro: "relation services does not exist"
**Solução:** Execute o schema completo (`SCHEMA_COMPLETO.sql`)

### Erro: "new row violates row-level security policy"
**Solução:** Desabilite RLS temporariamente:
```sql
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
```

### Erro: "null value in column professional_id violates not-null constraint"
**Solução:** Verifique se o utilizador está autenticado corretamente:
- Faça logout e login novamente
- Verifique localStorage no navegador (F12 > Application > Local Storage)

### Erro: "invalid input syntax for type interval"
**Solução:** Certifique-se de que a duração está no formato correto: "60 minutes"

### Erro: "permission denied for table services"
**Solução:** Execute:
```sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
```

## Teste Final

Após corrigir, teste criar um serviço:

1. Faça login como profissional
2. Vá para "Serviços" > "Adicionar Novo Serviço"
3. Preencha todos os campos obrigatórios:
   - Título
   - Descrição
   - Preço
   - Duração
   - Número WhatsApp (formato: +351912345678)
   - Categoria
4. Clique em "Guardar"
5. Verifique o console do navegador (F12) para logs detalhados

## Logs Esperados no Console

Se tudo estiver funcionando:

```
User ID: "uuid-do-usuario"
Form Data: { title: "...", ... }
Service Data to save: { title: "...", professional_id: "...", ... }
Supabase Response: { error: null, data: [...] }
```

Se houver erro:

```
Supabase Response: {
  error: {
    message: "mensagem específica do erro",
    code: "...",
    details: "..."
  },
  data: null
}
```

## Precisa de Ajuda?

Com os logs detalhados do console, conseguiremos identificar exatamente qual é o problema!
