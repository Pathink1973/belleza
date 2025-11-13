# Instruções de Migração para Supabase Auth

## O que foi feito?

Migrei toda a aplicação para usar o **Supabase Auth nativo**. Agora todos os dados (login, registro, perfis, serviços) são guardados no Supabase externo que você forneceu.

### Alterações realizadas:

1. **src/lib/auth.ts** - Reescrito para usar `supabase.auth.signUp()`, `signInWithPassword()`, etc.
2. **src/store/authStore.ts** - Atualizado para usar sessões do Supabase e listener de mudanças de auth
3. **Nova migração** - `supabase/migrations/20250503000000_supabase_auth_setup.sql` com trigger para auto-criar profiles

## Passo a Passo para Aplicar

### 1. Aplicar a Migração no Supabase

Acesse o SQL Editor do seu Supabase:
👉 **https://vsdysxjqmpjpxzuwwvmm.supabase.co/project/_/sql**

Cole e execute este SQL:

```sql
-- Drop old custom auth functions if they exist
DROP FUNCTION IF EXISTS register_user CASCADE;
DROP FUNCTION IF EXISTS login_user CASCADE;

-- Ensure profiles table has correct structure
DO $$
BEGIN
  -- Add column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bio text;
  END IF;
END $$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, mobile_number)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'professional'),
    new.raw_user_meta_data->>'mobile_number'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable RLS on profiles (if not already enabled)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create RLS policies for profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;
```

### 2. Configurar Email Auth no Supabase

1. Acesse: **https://vsdysxjqmpjpxzuwwvmm.supabase.co/project/_/auth/providers**
2. Em **Email Auth**, certifique-se que:
   - ✅ **Enable Email provider** está ativo
   - ✅ **Confirm email** está **DESATIVADO** (para facilitar testes)
   - ✅ **Secure email change** está ativo

### 3. Limpar Dados Locais

No navegador, abra o Console (F12) e execute:

```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 4. Testar Registro

1. Acesse a aplicação
2. Clique em **Registar**
3. Preencha:
   - Email: `teste@example.com`
   - Password: `senha123`
   - Nome Completo: `João Silva`
   - Telefone: `911234567`
4. Clique em **Registar**

### 5. Verificar se Funcionou

#### No Console do Navegador (F12):
```javascript
// Ver sessão atual
const { data } = await supabase.auth.getSession();
console.log('Sessão:', data.session);
console.log('User ID:', data.session?.user?.id);
```

#### No SQL Editor do Supabase:
```sql
-- Ver utilizadores criados
SELECT * FROM auth.users;

-- Ver profiles criados
SELECT * FROM profiles;
```

### 6. Testar Criar Serviço

1. Faça login
2. Vá para **Serviços > Adicionar Novo Serviço**
3. Preencha os dados
4. Clique em **Guardar**
5. Deve funcionar sem erros!

## Como Funciona Agora

### Registro (Sign Up):
1. User preenche formulário
2. `supabase.auth.signUp()` cria utilizador em `auth.users`
3. Trigger `on_auth_user_created` automaticamente cria perfil em `profiles`
4. User é logado automaticamente

### Login (Sign In):
1. User preenche email/senha
2. `supabase.auth.signInWithPassword()` valida credenciais
3. Supabase retorna sessão + JWT token
4. App busca perfil em `profiles`
5. User está logado

### Criar Serviço:
1. User logado tem `user.id` do `auth.users`
2. Esse `user.id` existe em `profiles` (criado pelo trigger)
3. Serviço é criado com `professional_id = user.id`
4. Foreign key funciona! ✅

## Debugging

Se ainda tiver problemas:

### 1. Verificar Auth Email Settings
```sql
-- Ver configuração de email
SELECT * FROM auth.config;
```

### 2. Ver logs de erros
No Console do navegador (F12), procure por:
- ❌ "Supabase Auth Error"
- ❌ "Profile fetch error"
- ❌ "Profile insert error"

### 3. Testar manualmente no Supabase
```sql
-- Criar user de teste
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
VALUES (
  gen_random_uuid(),
  'manual@test.com',
  crypt('senha123', gen_salt('bf')),
  now(),
  '{"full_name": "Teste Manual", "role": "professional"}'::jsonb
);

-- Ver se profile foi criado
SELECT * FROM profiles WHERE full_name = 'Teste Manual';
```

## Vantagens da Nova Implementação

✅ Auth nativo do Supabase (seguro e robusto)
✅ JWT tokens gerenciados automaticamente
✅ Sessões persistentes no localStorage
✅ Profiles criados automaticamente via trigger
✅ Foreign keys funcionam corretamente
✅ RLS configurado para segurança
✅ Todos os dados no Supabase externo

## Próximos Passos Recomendados

1. Testar registro e login
2. Testar criar serviços
3. Testar criar clientes
4. Verificar se todos os dados aparecem no Supabase
5. Configurar email de confirmação (opcional)

Qualquer dúvida, me avise!
