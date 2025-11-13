# Guia Completo do Banco de Dados

## Como Usar o Schema Completo

### Passo 1: Acessar o SQL Editor do Supabase

Acesse o SQL Editor:
```
https://0ec90b57d6e95fcbda19832f.supabase.co/project/_/sql
```

### Passo 2: Executar o Schema Completo

1. Abra o arquivo `SCHEMA_COMPLETO.sql`
2. Copie **TODO** o conteúdo
3. Cole no SQL Editor do Supabase
4. Clique em **"Run"**
5. Aguarde a confirmação de sucesso

## O que o Schema Cria?

### Tabelas Principais

1. **profiles** - Utilizadores do sistema
   - ID, email, password (hash), nome, role, avatar, mobile
   - Roles: client, professional, admin

2. **services** - Serviços oferecidos
   - Título, descrição, preço, duração, imagem, categoria
   - WhatsApp, equipe (team)

3. **bookings** - Agendamentos
   - Cliente, serviço, profissional
   - Horário início/fim, status, notas
   - Status: pending, confirmed, completed, cancelled

4. **reviews** - Avaliações
   - Rating (1-5), comentário
   - Vinculado a booking e serviço

5. **clients** - Info adicional de clientes
   - Notas, preferências por profissional

6. **client_notes** - Notas sobre clientes
   - Histórico de interações

7. **availability** - Disponibilidade dos profissionais
   - Dia da semana, horário início/fim

8. **blocked_dates** - Datas bloqueadas
   - Feriados, férias, etc.

9. **calendar_notes** - Notas no calendário
   - Notas por data e horário

### Funções Disponíveis

#### 1. `register_user(email, password, name, role, mobile)`

Registra um novo utilizador:

```sql
SELECT register_user(
  'joao@exemplo.com',
  'senha123',
  'João Silva',
  'professional',
  '+351912345678'
);
```

Retorna:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "joao@exemplo.com",
    "full_name": "João Silva",
    "role": "professional",
    ...
  }
}
```

#### 2. `login_user(email, password, role)`

Faz login:

```sql
SELECT login_user(
  'joao@exemplo.com',
  'senha123',
  'professional'
);
```

#### 3. `get_client_stats(professional_id, client_id)`

Obtém estatísticas de um cliente:

```sql
SELECT get_client_stats(
  'uuid-do-profissional',
  'uuid-do-cliente'
);
```

Retorna:
```json
{
  "total_bookings": 10,
  "completed_bookings": 8,
  "cancelled_bookings": 1,
  "total_spent": 450.00,
  "average_rating": 4.5,
  "last_visit": "2025-11-01T10:00:00Z",
  "notes_count": 3
}
```

### Triggers Automáticos

Todos os campos `updated_at` são atualizados automaticamente quando um registro é modificado.

### Índices para Performance

Todos os campos frequentemente consultados têm índices:
- IDs de referências (foreign keys)
- Emails
- Datas
- Status
- Categorias

## Segurança

### Row Level Security (RLS)

**IMPORTANTE**: RLS está **DESABILITADO** para desenvolvimento local.

Antes de ir para produção:
1. Reabilitar RLS em todas as tabelas
2. Configurar políticas apropriadas
3. Migrar para Supabase Auth

### Passwords

- Armazenados com hash bcrypt usando `pgcrypto`
- Nunca retornados nas queries
- Salt gerado automaticamente

## Verificar Instalação

Após executar o schema, verifique se tudo funcionou:

```sql
-- Listar todas as tabelas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar funções
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION';
```

## Limpar e Recomeçar

Se precisar limpar tudo e recomeçar:

```sql
-- ATENÇÃO: Isto deleta TUDO!
DROP TABLE IF EXISTS calendar_notes CASCADE;
DROP TABLE IF EXISTS blocked_dates CASCADE;
DROP TABLE IF EXISTS availability CASCADE;
DROP TABLE IF EXISTS client_notes CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

DROP FUNCTION IF EXISTS register_user CASCADE;
DROP FUNCTION IF EXISTS login_user CASCADE;
DROP FUNCTION IF EXISTS get_client_stats CASCADE;
DROP FUNCTION IF EXISTS update_timestamp CASCADE;
```

Depois execute o `SCHEMA_COMPLETO.sql` novamente.

## Apenas Limpar Dados (Manter Estrutura)

Se quiser manter as tabelas mas limpar os dados:

```sql
TRUNCATE profiles, services, bookings, reviews, clients,
         client_notes, availability, blocked_dates,
         calendar_notes CASCADE;
```

## Testar o Sistema

1. Registre um utilizador profissional
2. Faça login
3. Crie um serviço
4. Veja se aparece na lista

Se tudo funcionar, o sistema está pronto!

## Estrutura de Dados Exemplo

### Criar um Profissional

```sql
SELECT register_user(
  'maria@salao.com',
  'senha123',
  'Maria Santos',
  'professional',
  '+351987654321'
);
```

### Criar um Serviço

```sql
INSERT INTO services (
  professional_id,
  title,
  description,
  price,
  duration,
  category,
  image_url,
  whatsapp_number
) VALUES (
  'uuid-do-profissional',
  'Corte de Cabelo',
  'Corte moderno e personalizado',
  25.00,
  '60 minutes',
  'Cabeleireiro',
  'https://exemplo.com/imagem.jpg',
  '+351987654321'
);
```

### Criar um Agendamento

```sql
INSERT INTO bookings (
  client_id,
  professional_id,
  service_id,
  start_time,
  end_time,
  status
) VALUES (
  'uuid-do-cliente',
  'uuid-do-profissional',
  'uuid-do-servico',
  '2025-11-10 14:00:00+00',
  '2025-11-10 15:00:00+00',
  'pending'
);
```

## Problemas Comuns

### "relation already exists"
As tabelas já existem. Delete-as primeiro ou use `IF NOT EXISTS` (já incluído no schema).

### "permission denied"
Certifique-se de estar usando o SQL Editor com as credenciais corretas.

### "function does not exist"
Execute o schema completo novamente para criar todas as funções.

## Suporte

Se encontrar problemas:
1. Verifique o console do navegador (F12)
2. Verifique os logs do Supabase
3. Certifique-se de que o schema foi executado completamente
