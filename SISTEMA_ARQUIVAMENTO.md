# Sistema de Arquivamento de Reservas

## Visão Geral

Este documento descreve o sistema completo de arquivamento de reservas implementado na aplicação. O sistema permite que o calendário mostre apenas reservas ativas, com opção de visualizar reservas arquivadas e limpar dados permanentemente.

## Funcionalidades Implementadas

### 1. Filtro Automático no Calendário

**Comportamento:**
- Por padrão, o calendário exibe apenas reservas com status `pending` e `confirmed`
- Reservas `completed` e `cancelled` são automaticamente ocultadas
- Query otimizada com índices compostos para melhor performance

**Benefícios:**
- Calendário sempre limpo e focado nas tarefas pendentes
- Melhor experiência visual para o profissional
- Performance otimizada com queries filtradas

### 2. Toggle "Mostrar Arquivadas"

**Localização:** Canto superior direito do calendário

**Funcionalidade:**
- Botão toggle para exibir/ocultar reservas arquivadas
- Badge mostrando quantidade de reservas arquivadas
- Ícone de olho que muda conforme estado
- Reservas arquivadas aparecem em tons de cinza quando visíveis

**Aparência:**
- Ativo: Fundo azul, ícone EyeOff
- Inativo: Fundo branco, ícone Eye, badge com contagem

### 3. Sistema de Limpeza de Dados

**Localização:** Botão "Limpar Dados" no cabeçalho do calendário

**Processo de Limpeza:**

#### Passo 1: Modal de Confirmação
- Aviso destacado sobre irreversibilidade da ação
- Mostra quantidade exata de reservas que serão deletadas
- Lista o que será removido (reservas + notificações relacionadas)

#### Passo 2: Exportação de Backup (Opcional)
- Botão para exportar dados antes da exclusão
- Formato: JSON com todas as informações das reservas
- Nome do arquivo: `reservas-arquivadas-YYYY-MM-DD.json`
- Inclui: dados do cliente, serviço, horários, status, notas

#### Passo 3: Confirmação Final
- Campo de texto para digitar: `CONFIRMAR EXCLUSAO`
- Validação rigorosa do texto de confirmação
- Botões desabilitados até confirmação válida

#### Passo 4: Execução
- Stored procedure segura no banco de dados
- Transação atômica (tudo ou nada)
- Registro automático no audit log
- Feedback visual com loading e mensagens

### 4. Estrutura do Banco de Dados

#### Nova Coluna: `archived_at`
```sql
ALTER TABLE bookings ADD COLUMN archived_at timestamptz;
```

**Propósito:**
- Registra quando uma reserva foi arquivada
- Atualizada automaticamente via trigger
- Útil para relatórios e auditoria

#### Nova Tabela: `audit_log`
```sql
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  performed_by uuid REFERENCES profiles(id),
  details jsonb DEFAULT '{}'::jsonb,
  records_affected integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
```

**Propósito:**
- Registra todas as limpezas de dados realizadas
- Rastreabilidade completa de ações administrativas
- Informações em formato JSON para flexibilidade
- RLS aplicado para segurança

#### Índices Criados

1. **bookings_active_idx**
   ```sql
   CREATE INDEX ON bookings(professional_id, status, start_time)
   WHERE status IN ('pending', 'confirmed');
   ```
   - Otimiza queries de reservas ativas
   - Índice parcial para economia de espaço

2. **bookings_archived_at_idx**
   ```sql
   CREATE INDEX ON bookings(archived_at)
   WHERE archived_at IS NOT NULL;
   ```
   - Para consultas de histórico
   - Relatórios de reservas arquivadas

### 5. Stored Procedures

#### `cleanup_archived_bookings(p_professional_id, p_confirmation_text)`

**Funcionalidade:**
- Deleta permanentemente reservas arquivadas
- Verifica permissões do usuário
- Valida texto de confirmação
- Registra ação no audit_log
- Retorna resultado em JSON

**Retorno:**
```json
{
  "success": true,
  "deleted_count": 42,
  "message": "Successfully deleted 42 archived bookings"
}
```

#### `export_archived_bookings_data(p_professional_id)`

**Funcionalidade:**
- Exporta dados de reservas arquivadas
- Formato JSON com informações completas
- Join com profiles e services para dados relacionados
- Retorna array vazio se não houver dados

**Estrutura do Export:**
```json
[
  {
    "id": "uuid",
    "client_name": "Nome do Cliente",
    "client_email": "email@exemplo.com",
    "client_phone": "+351912345678",
    "service_title": "Nome do Serviço",
    "start_time": "2025-11-06T10:00:00Z",
    "end_time": "2025-11-06T11:00:00Z",
    "status": "completed",
    "notes": "Observações",
    "created_at": "2025-11-01T08:00:00Z",
    "archived_at": "2025-11-06T11:00:00Z"
  }
]
```

### 6. Trigger Automático

```sql
CREATE TRIGGER set_archived_at_trigger
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_archived_at();
```

**Comportamento:**
- Dispara antes de atualizar uma reserva
- Detecta mudança de status para `completed` ou `cancelled`
- Define `archived_at` automaticamente com timestamp atual
- Não afeta outros updates na tabela

### 7. Animações e Transições

#### Classes CSS Adicionadas:

**booking-archived**
```css
.booking-archived {
  transition: all 0.3s ease-in-out;
  opacity: 0.6;
  filter: grayscale(0.5);
}
```

**booking-active**
```css
.booking-active {
  transition: all 0.3s ease-in-out;
  opacity: 1;
  filter: grayscale(0);
}
```

**Efeitos:**
- Fade suave ao arquivar reserva
- Grayscale para reservas arquivadas
- Transições de 300ms para suavidade

### 8. Segurança e Permissões

#### RLS Policies

**audit_log:**
- SELECT: Apenas usuários podem ver seus próprios logs
- INSERT: Apenas professionals, admins e super_admins
- Proteção contra modificação não autorizada

**Validações:**
- Texto de confirmação exato obrigatório
- Verificação de role do usuário
- SECURITY DEFINER nas stored procedures
- Proteção contra SQL injection

## Fluxo de Uso

### Uso Diário Normal

1. Profissional acessa o calendário
2. Vê apenas reservas pendentes e confirmadas
3. Ao concluir uma reserva, ela desaparece automaticamente
4. Calendário permanece limpo e organizado

### Visualizar Histórico

1. Clicar no botão "Mostrar Arquivadas"
2. Reservas concluídas/canceladas aparecem em cinza
3. Badge mostra quantidade total de arquivadas
4. Clicar novamente para ocultar

### Limpar Dados (Reiniciar Aplicação)

1. Clicar no botão "Limpar Dados" (vermelho)
2. Ler aviso sobre irreversibilidade
3. (Opcional) Clicar em "Exportar Backup"
4. Digitar "CONFIRMAR EXCLUSAO" no campo
5. Clicar em "Deletar Permanentemente"
6. Aguardar confirmação de sucesso
7. Calendário atualiza automaticamente

## Casos de Uso

### Caso 1: Profissional Novo
- Cadastra serviços
- Recebe primeiras reservas
- Calendário mostra apenas reservas ativas
- Foco total em agendamentos pendentes

### Caso 2: Profissional com Histórico
- Tem 100+ reservas concluídas
- Calendário mostra apenas 5 reservas ativas
- Performance mantida com índices
- Pode visualizar arquivadas quando necessário

### Caso 3: Reiniciar do Zero
- Fim de ano, quer começar limpo
- Exporta backup dos dados antigos
- Confirma limpeza com texto específico
- Sistema deleta apenas reservas arquivadas
- Serviços e clientes mantidos intactos

### Caso 4: Auditoria
- Administrador precisa verificar limpezas
- Acessa tabela audit_log
- Vê histórico completo de exclusões
- Timestamp, usuário e quantidade de registros

## Vantagens da Implementação

### Performance
- Queries otimizadas com índices parciais
- Apenas dados relevantes carregados
- Paginação natural pelo filtro de status

### Experiência do Usuário
- Interface limpa e focada
- Feedback visual constante
- Animações suaves
- Processo de limpeza seguro e guiado

### Segurança
- Múltiplas confirmações antes de deletar
- Audit trail completo
- RLS aplicado em todas as tabelas
- Validação de permissões

### Manutenibilidade
- Código modular e organizado
- Componente CleanupModal reutilizável
- Stored procedures testáveis
- Documentação inline

## Arquivos Modificados/Criados

### Novos Arquivos:
1. `/supabase/migrations/20251106120000_add_booking_archival_system.sql`
2. `/src/components/CleanupModal.tsx`
3. `/SISTEMA_ARQUIVAMENTO.md` (este arquivo)

### Arquivos Modificados:
1. `/src/pages/Calendar.tsx`
   - Adicionado filtro de status
   - Toggle para mostrar arquivadas
   - Integração com CleanupModal
   - Contador de reservas ativas/arquivadas

2. `/src/index.css`
   - Animações de fade e archive
   - Classes booking-archived e booking-active
   - Transições suaves

## Próximos Passos Sugeridos

### Melhorias Futuras (Opcional):

1. **Arquivamento Automático Programado**
   - Opção nas configurações
   - Deletar reservas após X dias/meses
   - Notificação antes da execução

2. **Relatórios Avançados**
   - Dashboard com estatísticas de reservas arquivadas
   - Gráficos de tendências
   - Export em PDF além de JSON

3. **Recuperação de Dados**
   - Período de "soft delete" (30 dias)
   - Possibilidade de desfazer limpeza
   - Backup automático na nuvem

4. **Notificações**
   - Email ao profissional após limpeza
   - Resumo mensal de reservas arquivadas
   - Alerta quando atingir limite de registros

## Suporte e Manutenção

### Verificar Saúde do Sistema:

```sql
-- Ver reservas arquivadas por profissional
SELECT
  p.full_name,
  COUNT(*) as archived_count,
  MAX(b.archived_at) as last_archived
FROM bookings b
JOIN profiles p ON b.professional_id = p.id
WHERE b.status IN ('completed', 'cancelled')
GROUP BY p.id, p.full_name;

-- Ver histórico de limpezas
SELECT
  al.created_at,
  p.full_name as performed_by,
  al.records_affected,
  al.details
FROM audit_log al
JOIN profiles p ON al.performed_by = p.id
WHERE al.action = 'cleanup_archived_bookings'
ORDER BY al.created_at DESC;

-- Verificar performance dos índices
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'bookings';
```

## Conclusão

O sistema de arquivamento implementado fornece uma solução completa e elegante para gerenciar o ciclo de vida das reservas. Com foco em usabilidade, performance e segurança, permite que profissionais mantenham seus calendários limpos enquanto preservam dados importantes para análises futuras.

A arquitetura modular facilita manutenção e expansões futuras, enquanto as múltiplas camadas de validação garantem que dados não sejam perdidos acidentalmente.
