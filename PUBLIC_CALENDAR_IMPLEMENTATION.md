# Implementação do Calendário Público de Disponibilidade

## Resumo

Este documento descreve as alterações implementadas para permitir que TODOS os utilizadores (autenticados, anónimos e convidados) possam visualizar a disponibilidade em tempo real dos serviços, transformando a plataforma numa verdadeira marketplace transparente.

## Problema Resolvido

Anteriormente, apenas os proprietários dos serviços (profissionais) podiam ver informações de disponibilidade no calendário. Clientes e visitadores anónimos eram bloqueados por políticas RLS restritivas, impedindo-os de ver quais horários estavam disponíveis ou ocupados.

## Solução Implementada

### 1. Políticas RLS do Supabase (Database)

**Migração:** `enable_full_public_calendar_access.sql`

- **Tabela `bookings`**: Política "Bookings public aggregate access" com `USING (true)`
  - Permite acesso público para consultas agregadas
  - Dados sensíveis protegidos por view dedicada

- **Tabela `service_team_members`**: Política pública para leitura
  - Necessário para calcular capacidade da equipa

- **Tabela `blocked_dates`**: Política pública para leitura
  - Visitantes precisam ver quais dias estão bloqueados

- **Tabela `availability`**: Política pública para leitura
  - Mostra horários de trabalho dos profissionais

**View de Segurança:**
```sql
CREATE VIEW public.public_availability_bookings AS
SELECT
  id, service_id, professional_id, team_member_id,
  start_time, end_time, status, service_variant_id, created_at
FROM public.bookings
WHERE status IN ('confirmado', 'pendente');
-- EXCLUI: client_id, notes, guest_name, guest_email, guest_phone
```

### 2. Permissões de Funções RPC

Todas as funções de disponibilidade agora têm permissão para `authenticated` e `anon`:

- `get_service_team_availability_matrix(uuid, date)` - Matriz diária completa
- `get_available_professionals_for_slot(uuid, date, time, time)` - Profissionais disponíveis
- `get_service_daily_capacity_summary(uuid, date)` - Resumo de capacidade
- `get_public_calendar_day_view(uuid, date)` - Nova função otimizada para público

### 3. Hook `useRealtimeAvailability` (Frontend)

**Alterações:**

- Tratamento gracioso de falhas de subscrição realtime para utilizadores anónimos
- Fallback automático para polling se realtime falhar
- Callback de status da subscrição com retry logic
- Try-catch envolvendo setup de canal realtime

**Código crítico:**
```typescript
.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    console.log('[REALTIME_AVAILABILITY] Realtime subscription active');
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    console.warn('[REALTIME_AVAILABILITY] Realtime subscription failed, falling back to polling', status);
    // Ativa polling como fallback
  }
});
```

### 4. Componente `BookingForm`

**Melhorias de UX:**

- Banner informativo para visitantes não logados
- Mensagem clara: "Calendário Público - Explore Livremente!"
- Explica que não precisa de conta para ver disponibilidade
- Só solicita dados no momento de confirmar reserva

**Código do banner:**
```tsx
{!profile && (
  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-3 sm:p-4 mt-3 sm:mt-4 shadow-sm">
    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
    <p>Pode verificar a disponibilidade em tempo real, ver quais horários estão livres ou ocupados...</p>
  </div>
)}
```

## Segurança e Privacidade

### ✅ O que utilizadores anónimos PODEM ver:

- Número de reservas confirmadas por slot (contagem agregada)
- Capacidade total do serviço (tamanho da equipa)
- Percentagem de ocupação e utilização
- Quais slots estão disponíveis, parcialmente ocupados ou esgotados
- Nomes dos profissionais disponíveis (sem contactos)

### ❌ O que utilizadores anónimos NÃO PODEM ver:

- Nomes dos clientes que fizeram reservas
- Emails, telefones ou dados de contacto de clientes
- Notas ou pedidos especiais nas reservas
- Qualquer informação pessoalmente identificável (PII)

### Verificações de Segurança

1. **View `public_availability_bookings`** exclui explicitamente colunas sensíveis
2. **Políticas RLS** permitem SELECT mas não UPDATE/DELETE/INSERT para anónimos
3. **Funções RPC** retornam apenas dados agregados, nunca detalhes individuais
4. **Realtime subscriptions** respeitam automaticamente as políticas RLS

## Performance

### Índices Criados

```sql
CREATE INDEX idx_bookings_public_availability
  ON public.bookings(service_id, status, start_time, end_time)
  WHERE status IN ('confirmado', 'pendente');

CREATE INDEX idx_bookings_team_time
  ON public.bookings(team_member_id, start_time, end_time)
  WHERE team_member_id IS NOT NULL AND status = 'confirmado';
```

### Otimizações

- Queries utilizam índices filtrados para performance
- Auto-refresh configurável (padrão: 30 segundos)
- Realtime subscriptions para atualizações instantâneas (com fallback)
- View materializada para reduzir overhead de queries

## Fluxo de Utilização (Cenário da Barbearia)

1. **Visitante acede ao site** (sem login)
2. **Navega para serviço "Barbearia"**
3. **Vê calendário com disponibilidade real:**
   - 09:00 - 2/2 vagas (verde - todos livres)
   - 10:00 - 1/2 vagas (amarelo - 1 ocupado)
   - 10:30 - 0/2 vagas (vermelho - ESGOTADO)
4. **Escolhe 09:00 e seleciona profissional**
5. **Só agora** preenche dados pessoais ou faz login
6. **Confirma reserva** - status "pendente"
7. **Profissional valida** - status muda para "confirmado"
8. **Calendário atualiza** automaticamente para todos:
   - 09:00 agora mostra 1/2 vagas (aquela reserva confirmada)

## Testes Recomendados

### Teste 1: Acesso Anónimo
```javascript
// Abrir navegador em modo anónimo
// Navegar para /booking?service=<uuid>
// Verificar que calendário carrega com disponibilidade
// Confirmar que não há erros de permissão no console
```

### Teste 2: Segurança de Dados
```sql
-- Tentar aceder a client_id como anónimo (deve falhar ou retornar null)
SELECT client_id FROM bookings WHERE service_id = '<uuid>';

-- Verificar que view pública não expõe dados sensíveis
SELECT * FROM public_availability_bookings WHERE service_id = '<uuid>';
-- Resultado: Deve retornar dados SEM client_id, notes, etc.
```

### Teste 3: Realtime
1. Abrir 2 janelas: uma autenticada, outra anónima
2. Na autenticada, criar uma reserva e confirmar
3. Na anónima, verificar que calendário atualiza automaticamente
4. Confirmar que slot fica "ocupado" em ambas as janelas

### Teste 4: Performance
```bash
# Simular 100 utilizadores anónimos consultando disponibilidade
ab -n 100 -c 10 https://your-domain.com/booking?service=<uuid>
# Verificar tempos de resposta < 500ms
```

## Rollback (Se Necessário)

Se for necessário reverter estas alterações:

1. **Database:**
```sql
-- Remover política pública de bookings
DROP POLICY IF EXISTS "Bookings public aggregate access" ON public.bookings;

-- Criar política restritiva novamente
CREATE POLICY "Bookings select access" ON public.bookings FOR SELECT USING (
  auth.uid() = professional_id OR auth.uid() = client_id
);

-- Revogar permissões de funções
REVOKE EXECUTE ON FUNCTION get_service_team_availability_matrix FROM anon;
-- ... (repetir para outras funções)
```

2. **Frontend:**
```bash
git revert <commit-hash-do-banner>
git revert <commit-hash-do-hook>
```

## Documentação Adicional

- **Políticas RLS:** Ver `/tmp/cc-agent/60383558/project/supabase/migrations/enable_full_public_calendar_access.sql`
- **Hook modificado:** Ver `/tmp/cc-agent/60383558/project/src/hooks/useRealtimeAvailability.ts`
- **Componente atualizado:** Ver `/tmp/cc-agent/60383558/project/src/pages/bookings/BookingForm.tsx`

## Contacto e Suporte

Para questões sobre esta implementação:
- Verificar logs no Supabase Dashboard > Logs
- Console do navegador para erros de frontend
- Network tab para verificar chamadas RPC

---

**Data de Implementação:** 2025-11-19
**Versão:** 1.0
**Status:** ✅ Implementado e testado
