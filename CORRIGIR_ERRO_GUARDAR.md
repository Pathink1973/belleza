# Corrigir Erro ao Guardar Serviço

## Problema Identificado

**Erro:** `insert or update on table "services" violates foreign key constraint "services_professional_id_fkey"`

**Causa:** O `professional_id` que está sendo usado não existe na tabela `profiles`.

Isso acontece porque o sistema atual usa autenticação customizada, mas quando você faz login, o `user.id` retornado não está na tabela `profiles`.

## Solução: Verificar e Criar Profile

Vou verificar se o seu perfil existe na tabela `profiles`. Se não existir, vamos criá-lo.

### Passo 1: Abrir Console do Navegador

1. Pressione **F12** no navegador
2. Vá para a aba **Console**
3. Cole e execute este comando:

```javascript
const user = JSON.parse(localStorage.getItem('auth-store'));
console.log('User ID:', user?.state?.user?.id);
console.log('User completo:', user?.state?.user);
```

4. **Copie o User ID que aparecer**

### Passo 2: Verificar se Profile Existe

No SQL Editor do Supabase (https://vsdysxjqmpjpxzuwwvmm.supabase.co/project/_/sql):

```sql
-- Substitua 'SEU-USER-ID-AQUI' pelo ID que copiou no Passo 1
SELECT * FROM profiles WHERE id = 'SEU-USER-ID-AQUI';
```

Se retornar **vazio** (sem resultados), significa que o perfil não existe!

### Passo 3: Criar o Profile Manualmente

Se o perfil não existir, execute no SQL Editor:

```sql
-- Substitua os valores:
-- 'SEU-USER-ID-AQUI' = ID que copiou no Passo 1
-- 'Seu Nome Completo' = Seu nome
-- 'seu@email.com' = Seu email

INSERT INTO profiles (id, full_name, email, role, created_at, updated_at)
VALUES (
  'SEU-USER-ID-AQUI',
  'Seu Nome Completo',
  'seu@email.com',
  'professional',
  now(),
  now()
);
```

**Exemplo:**
```sql
INSERT INTO profiles (id, full_name, email, role, created_at, updated_at)
VALUES (
  '123e4567-e89b-12d3-a456-426614174000',
  'João Silva',
  'joao@example.com',
  'professional',
  now(),
  now()
);
```

### Passo 4: Verificar se Funcionou

```sql
SELECT * FROM profiles WHERE role = 'professional';
```

Deve mostrar o seu perfil!

### Passo 5: Testar Criar Serviço

Agora tente criar um serviço novamente. Deve funcionar!

## Solução Alternativa: Desabilitar Foreign Key Temporariamente

Se ainda não funcionar, podemos temporariamente remover a restrição:

```sql
-- ATENÇÃO: Use apenas para desenvolvimento!
ALTER TABLE services DROP CONSTRAINT services_professional_id_fkey;

-- Depois de adicionar os perfis, pode recriar:
ALTER TABLE services
ADD CONSTRAINT services_professional_id_fkey
FOREIGN KEY (professional_id)
REFERENCES profiles(id)
ON DELETE CASCADE;
```

## Logs Detalhados

Como adicionei logs detalhados, você verá no console do navegador:
- User ID: [seu-id]
- Form Data: [dados do formulário]
- Service Data to save: [dados enviados]
- Supabase Response: [resposta com erro detalhado]

Isso ajuda a identificar exatamente onde está o problema!

## Precisa de Ajuda?

1. Copie o **User ID** do console
2. Copie a **mensagem de erro completa** do console
3. Me mostre e eu ajudo a criar o profile correto!
