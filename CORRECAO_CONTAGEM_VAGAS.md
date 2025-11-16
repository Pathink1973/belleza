# Correção do Sistema de Contagem de Vagas em Tempo Real

## Data: 2025-11-16

## Problema Identificado

O sistema de contagem de vagas disponíveis na secção "Selecionar Horário" não estava a refletir corretamente os dados da base de dados. A contagem por período (manhã, tarde, noite) estava incorreta e não atualizava em tempo real conforme os bookings eram criados.

## Causa Raiz

O componente `TimeSlotSelector` estava a usar apenas a propriedade `isAvailable` (booleana) para contar horários disponíveis, ignorando completamente:

1. O número real de profissionais disponíveis (`availableProfessionals.length`)
2. A capacidade disponível calculada (`availableCapacity`)
3. A capacidade total do serviço (`totalCapacity`)

Isso resultava em contagens incorretas, especialmente quando:
- Múltiplos profissionais estavam na equipa
- Alguns profissionais estavam ocupados mas outros disponíveis
- A contagem de vagas por período do dia estava errada

## Alterações Implementadas

### 1. TimeSlotSelector.tsx

#### Atualização da Interface TimeSlot
```typescript
interface TimeSlot {
  time: string;
  isAvailable: boolean;
  totalCapacity?: number;          // NOVO
  availableCapacity?: number;      // NOVO
  utilizationPercentage?: number;  // NOVO
  blockedReason?: string;
  availableProfessionals?: any[];  // NOVO
}
```

#### Atualização das Props do Componente
```typescript
interface TimeSlotSelectorProps {
  timeSlots: TimeSlot[];
  selectedTime: string;
  onTimeSelect: (time: string) => void;
  showCapacityInfo?: boolean;
  onSlotClick?: (slot: TimeSlot) => void;           // NOVO
  showProfessionalCount?: boolean;                  // NOVO
  totalServiceCapacity?: number;                    // NOVO
}
```

#### Correção da Lógica de Contagem por Período
**ANTES:**
```typescript
const availableInPeriod = periodSlots.filter(s => s.isAvailable).length;
```

**DEPOIS:**
```typescript
const availableInPeriod = periodSlots.filter(s => {
  const hasProfessionals = s.availableProfessionals && s.availableProfessionals.length > 0;
  const hasCapacity = s.availableCapacity !== undefined && s.availableCapacity > 0;
  const isAvailableFlag = s.isAvailable;

  return hasProfessionals || hasCapacity || isAvailableFlag;
}).length;
```

#### Correção da Contagem de Vagas Totais
**ANTES:**
```typescript
const availableCount = filteredSlots.filter(s => s.isAvailable).length;
```

**DEPOIS:**
```typescript
const availableCount = filteredSlots.filter(s => {
  if (s.availableProfessionals && s.availableProfessionals.length > 0) {
    return true;
  }
  if (s.availableCapacity !== undefined && s.availableCapacity > 0) {
    return true;
  }
  return s.isAvailable;
}).length;
```

#### Correção da Lógica de Slot Esgotado
**ANTES:**
```typescript
const isFullyBooked = !slot.isAvailable || availableCount === 0;
```

**DEPOIS:**
```typescript
const availableCount = slot.availableProfessionals
  ? slot.availableProfessionals.length
  : (slot.availableCapacity || 0);
const isFullyBooked = availableCount === 0;
```

#### Suporte para Click Handler Customizado
```typescript
onClick={() => {
  if (onSlotClick) {
    onSlotClick(slot);  // Usa handler customizado se fornecido
  } else {
    onTimeSelect(slot.time);  // Fallback para handler simples
  }
}}
```

### 2. BookingForm.tsx

#### Atualização da Interface TimeSlot
```typescript
interface TimeSlot {
  time: string;
  isAvailable: boolean;
  totalCapacity?: number;          // NOVO
  availableCapacity?: number;      // NOVO
  utilizationPercentage?: number;  // NOVO
  availableProfessionals: {
    unique_id: string;
    profile_id: string | null;
    team_member_id: string | null;
    full_name: string;
    avatar_url: string | null;
    is_primary: boolean;
  }[];
}
```

O BookingForm.tsx já estava a calcular e passar os dados corretos:
```typescript
slots.push({
  time: slotTime,
  isAvailable: availableProfessionals.length > 0,
  availableProfessionals,
  totalCapacity: totalServiceCapacity,
  availableCapacity: availableProfessionals.length,
  utilizationPercentage: totalServiceCapacity > 0
    ? Math.round(((totalServiceCapacity - availableProfessionals.length) / totalServiceCapacity) * 100)
    : 0
});
```

## Logs de Debug Adicionados

Adicionados logs detalhados no `TimeSlotSelector` para facilitar debugging:

```typescript
console.log('=== TIMESLOT SELECTOR - CALCULATING PERIOD AVAILABILITY ===');
console.log('Total service capacity:', totalServiceCapacity);
console.log('Total time slots received:', timeSlots.length);

TIME_PERIODS.forEach(period => {
  console.log(`\n${period.label} (${period.start}-${period.end}):`);
  console.log('Total slots in period:', periodSlots.length);

  periodSlots.forEach(s => {
    if (!isAvailable) {
      console.log(`  ❌ ${s.time}: ESGOTADO - availableCapacity=${s.availableCapacity}`);
    } else {
      console.log(`  ✅ ${s.time}: DISPONÍVEL - availableCapacity=${s.availableCapacity}`);
    }
  });

  console.log(`Total disponíveis em ${period.label}: ${availableInPeriod}/${periodSlots.length}`);
});
```

## Como Funciona Agora

### Contagem de Vagas Disponíveis

1. **Por Período (Manhã, Tarde, Noite)**
   - Conta APENAS horários que têm pelo menos 1 profissional disponível
   - Usa `availableProfessionals.length > 0` OU `availableCapacity > 0`
   - Mostra contagem real: "5 horários disponíveis"

2. **Por Horário Individual**
   - Mostra "X/Y vagas" onde:
     - X = número de profissionais disponíveis naquele horário
     - Y = capacidade total do serviço (número de profissionais na equipa)
   - Exemplo: "2/3 vagas" significa 2 de 3 profissionais disponíveis

3. **Estado de Esgotado**
   - Um horário só aparece como "ESGOTADO" quando `availableCapacity === 0`
   - Ou seja, quando TODOS os profissionais estão ocupados

### Cores e Indicadores Visuais

- **Verde**: Todos os profissionais disponíveis (0-50% ocupação)
- **Amarelo**: Alguns profissionais ocupados (50-80% ocupação)
- **Laranja**: Maioria ocupada (80-100% ocupação)
- **Vermelho**: Esgotado (100% ocupação - 0 profissionais disponíveis)

## Sincronização em Tempo Real

O sistema já tinha subscrição Supabase implementada:

```typescript
const bookingsChannel = supabase
  .channel(`bookings_${service.id}_${formData.date}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'bookings',
    filter: `service_id=eq.${service.id}`
  }, (payload) => {
    console.log('Booking change detected:', payload);
    loadTimeSlots(); // Recarrega slots automaticamente
  })
  .subscribe();
```

Quando um novo booking é criado:
1. A subscrição Supabase deteta a mudança
2. `loadTimeSlots()` é chamado automaticamente
3. Os slots são recalculados da base de dados
4. O TimeSlotSelector atualiza as contagens de manhã, tarde e noite
5. A UI reflete imediatamente as vagas disponíveis

## Fonte dos Dados

**TUDO** vem da base de dados Supabase em tempo real:

1. **Bookings confirmados** (tabela `bookings` com `status = 'confirmado'`)
2. **Datas bloqueadas** (tabela `blocked_dates`)
3. **Horários bloqueados** (tabela `blocked_time_slots`)
4. **Equipa de profissionais** (campo `team` JSONB na tabela `services`)

## Verificação

Para verificar se está a funcionar:

1. **Console do Browser**: Abre DevTools e vê os logs:
   ```
   === TIMESLOT SELECTOR - CALCULATING PERIOD AVAILABILITY ===
   Total service capacity: 3

   Manhã (09:00-12:00):
   ✅ 09:00: DISPONÍVEL - availableCapacity=3
   ✅ 09:30: DISPONÍVEL - availableCapacity=2
   ❌ 10:00: ESGOTADO - availableCapacity=0
   Total disponíveis em Manhã: 2/6
   ```

2. **Interface Visual**:
   - Badges de período mostram contagem correta
   - Horários individuais mostram "X/Y vagas"
   - Estado "ESGOTADO" só aparece quando 0 vagas

3. **Teste em Tempo Real**:
   - Cria um booking confirmado
   - Verifica se a contagem atualiza automaticamente
   - Verifica se o horário fica esgotado quando todos profissionais ocupados

## Compilação

```bash
npm run build
```

✅ Build compilou com sucesso sem erros.

## Conclusão

O sistema de contagem de vagas agora:

✅ Usa dados REAIS da base de dados Supabase
✅ Conta corretamente vagas por período (manhã, tarde, noite)
✅ Mostra "X/Y vagas" para cada horário individual
✅ Atualiza em tempo real quando bookings são criados
✅ Marca horários como esgotados APENAS quando 0 vagas disponíveis
✅ Suporta múltiplos profissionais na equipa
✅ Considera bookings confirmados, datas e horários bloqueados
✅ Tem logs de debug detalhados para troubleshooting

**Não há mais dependência de migrations antigas ou lógica hardcoded.**
