# Visual Guide: Professional Availability Display

## Where Professional Counts Are Displayed

### 1. Monthly Calendar View 📅
**Location**: Professional Dashboard → Calendar Tab

**Display**:
- Badge on each day showing: "X disponíveis"
- Color-coded badges:
  - 🟢 Green: High availability (75%+)
  - 🟡 Yellow: Medium (50-75%)
  - 🟠 Orange: Low (25-50%)
  - 🔴 Red: "Esgotado" (0%)

**Example**:
```
┌─────────────────────────────────┐
│  Segunda  10                    │
│  ┌──────────────────────┐       │
│  │ 09:00 Tatto Studio   │       │
│  │ João Silva           │       │
│  └──────────────────────┘       │
│  🟢 3 disponíveis               │
└─────────────────────────────────┘
```

**What the user sees**:
- At a glance: How many professionals are available on each day
- Tooltip on hover: "3 de 5 profissionais disponíveis"
- Visual warning when capacity is low

---

### 2. Landing Page - Service Cards 🏠
**Location**: Home Page → Featured Services Section

**Display**:
- Compact badge below price: "X/Y" or "X disponíveis"
- Smart text based on availability:
  - "3 disponíveis" (when multiple available)
  - "1 disponível" (when only one)
  - "Esgotado" (when none available)

**Example**:
```
┌────────────────────────────────┐
│  [Service Image]               │
│  Corte de Cabelo Masculino     │
│  ⭐ 4.8 · €25,00               │
│  ⏱️ 30 minutos                 │
│  ─────────────────────────     │
│  [🟢 3/5]                      │
│  [Agendar] [WhatsApp]          │
└────────────────────────────────┘
```

**What the user sees**:
- Before clicking: Know if professionals are available today
- Decision making: Choose services with better availability
- Confidence: Book knowing there's capacity

---

### 3. Time Slot Selector ⏰
**Location**: Booking Form → Select Time Step

**Display**:
- Badge on EACH time slot showing "X/Y"
- Period summary (Morning/Afternoon/Evening)
- Color-coded by utilization
- "ESGOTADO" label when slot is full

**Example**:
```
┌─────────────────────────────────┐
│ Manhã  ☀️  09:00 - 12:00        │
│ 6 horários · Disponível         │
└─────────────────────────────────┘

Time Slots Grid:
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│09:00│ │09:30│ │10:00│ │10:30│
│🟢3/3│ │🟢3/3│ │🟡2/3│ │🟠1/3│
└─────┘ └─────┘ └─────┘ └─────┘

┌─────┐ ┌─────────┐
│11:00│ │  11:30  │
│🟠1/3│ │🔴ESGOTADO│
└─────┘ └─────────┘
```

**What the user sees**:
- Per-slot availability before selecting
- Visual indication of busy vs free times
- Clear "ESGOTADO" when slot is unavailable
- Can plan around busy periods

---

### 4. Professional List Popover (Detailed View) 👥
**Location**: Click "Ver profissionais" button anywhere

**Display**:
- Split view: Available vs Occupied
- Professional photos and names
- Status indicators (Disponível/Ocupado)
- Visual hierarchy with colors

**Example**:
```
┌──────────────────────────────────┐
│ 👥 Profissionais                 │
│ 3 de 5 disponíveis               │
├──────────────────────────────────┤
│ ✅ Disponíveis (3)               │
│                                  │
│ [👤] João Silva          🟢      │
│      Profissional Principal      │
│                                  │
│ [👤] Maria Santos        🟢      │
│                                  │
│ [👤] Pedro Costa         🟢      │
├──────────────────────────────────┤
│ ❌ Ocupados (2)                  │
│                                  │
│ [👤] Ana Rodrigues               │
│      Ocupado                     │
│                                  │
│ [👤] Carlos Lima                 │
│      Ocupado                     │
└──────────────────────────────────┘
```

**What the user sees**:
- Exactly who is available
- Professional photos for recognition
- Primary vs team member distinction
- Clear busy/free status

---

## Smart Display Logic Examples

### Small Team (1-2 professionals)

**Scenario**: Boutique salon with owner + 1 assistant

```
✅ 2 available → Badge shows: "João e Maria disponíveis"
✅ 1 available → Badge shows: "João disponível"
❌ 0 available → Badge shows: "Esgotado"
```

### Medium Team (3-5 professionals)

**Scenario**: Standard salon with 5 professionals

```
✅ 5 available → Badge shows: "5 disponíveis" (all free)
✅ 3 available → Badge shows: "3 disponíveis"
✅ 2 available → Badge shows: "João e Maria"
✅ 1 available → Badge shows: "Última vaga"
❌ 0 available → Badge shows: "Esgotado"
```

### Large Team (6+ professionals)

**Scenario**: Enterprise salon with 10 professionals

```
✅ 10 available → Badge shows: "10 profissionais disponíveis"
✅ 5 available → Badge shows: "5 disponíveis"
✅ 2 available → Badge shows: "Apenas 2 vagas"
✅ 1 available → Badge shows: "Última vaga"
❌ 0 available → Badge shows: "Esgotado"
```

---

## Color Coding System

### Utilization-Based Colors

| Utilization | Color | Meaning | Example |
|------------|-------|---------|---------|
| 0-25% | 🟢 Green | High availability | 4 of 5 free |
| 25-50% | 🟡 Yellow | Good availability | 3 of 5 free |
| 50-75% | 🟠 Orange | Low availability | 2 of 5 free |
| 75-100% | 🔴 Red | Almost full | 1 of 5 free |
| 100% | 🔴 Red | Esgotado | 0 of 5 free |

### Visual Indicators

**Available Professionals**:
- 🟢 Green pulse animation
- Bright colors
- "Disponível" label
- Clear photo

**Occupied Professionals**:
- Grayscale photo
- Dimmed appearance
- "Ocupado" label
- No animation

---

## Real-Time Updates

### What Happens When a Booking is Confirmed

```
Step 1: Professional confirms booking
   ↓
Step 2: Database updates booking status to "confirmado"
   ↓
Step 3: Supabase Real-time broadcasts change
   ↓
Step 4: All connected users receive update
   ↓
Step 5: UI components refetch availability
   ↓
Step 6: Badges update with new counts
   ↓
Step 7: Colors adjust based on new utilization
```

**User Experience**:
- Badge smoothly animates from "3 disponíveis" to "2 disponíveis"
- Color may change from green → yellow
- No page refresh needed
- Happens within 1-2 seconds

---

## Mobile Display Adaptations

### Phone View (< 640px)

**Calendar Badge**:
```
Compact format: "3"
instead of: "3 disponíveis"
```

**Time Slot**:
```
Stacked layout:
┌─────┐
│09:00│
│ 3/3 │
└─────┘
```

**Professional List**:
```
Bottom sheet modal
Swipe up to view
Full-screen overlay
```

### Tablet View (640px - 1024px)

**Calendar Badge**:
```
Medium format: "3 disponíveis"
```

**Time Slot**:
```
Grid layout (4 columns)
Larger touch targets
```

**Professional List**:
```
Popover (fixed position)
Positioned near trigger
```

---

## Badge Variants in Use

### Variant: `compact`
**Used on**: Landing page, tight spaces
```
Display: "3/5"
Size: Small
Icon: Users icon
```

### Variant: `default`
**Used on**: Calendar, standard views
```
Display: "3 disponíveis"
Size: Medium
Icon: Based on status
```

### Variant: `detailed`
**Used on**: Booking form, detailed views
```
Display: Full card with photos
Size: Large
Professional list visible
```

---

## User Journey Example

### Scenario: Maria wants to book a haircut

**Step 1**: Maria visits landing page
- Sees service cards with availability badges
- "Corte de Cabelo: 🟢 4 disponíveis"
- Thinks: "Great, they have availability!"

**Step 2**: Clicks "Agendar" button
- Goes to booking form
- Calendar shows month view with daily badges
- Sees Tuesday has "3 disponíveis" badge

**Step 3**: Selects Tuesday
- Time slots appear
- Each slot shows "X/Y" badge
- 10:00 shows "🟢3/3" (all three available)
- 14:00 shows "🟡2/3" (two available)
- 18:00 shows "🔴ESGOTADO" (fully booked)

**Step 4**: Selects 10:00 slot
- Clicks "Ver profissionais" to see who's available
- Popover shows:
  - ✅ João Silva - Disponível
  - ✅ Maria Santos - Disponível
  - ✅ Pedro Costa - Disponível
- All three professionals are free!

**Step 5**: Completes booking
- System automatically assigns João (first available)
- Other users immediately see:
  - 10:00 slot now shows "🟡2/3"
  - João appears in "Ocupado" section if they check
  - Calendar badge updates to "2 disponíveis"

---

## Technical Notes for Users

### Why counts update in real-time:
- System uses WebSocket connections
- Updates happen within 1-2 seconds
- No page refresh needed
- Works even if multiple people booking simultaneously

### Why "disponíveis" sometimes changes quickly:
- Another user just booked the same time
- Professional confirmed/cancelled a booking
- Team member was added or removed
- Normal behavior - system is working correctly!

### What "Esgotado" means:
- ALL professionals are busy at that exact time
- Not the entire day - just that specific slot
- Try nearby times (30 minutes before/after)
- System can suggest alternatives

### Why I see different counts on different pages:
- Landing page: Shows aggregate daily availability
- Calendar: Shows specific time slot availability
- Both are correct - just different granularity
- Landing page = "any time today"
- Calendar = "specific time slot"

---

## Benefits Summary

### For Clients:
✅ Know before booking if time is available
✅ See exactly how many professionals can serve them
✅ Make informed decisions about timing
✅ Get real-time updates preventing conflicts
✅ Feel confident booking knowing slot won't be taken

### For Professionals:
✅ See team capacity at a glance
✅ Identify peak demand times
✅ Optimize scheduling
✅ Prevent overbooking automatically
✅ Track utilization per team member

### For Platform:
✅ Modern, professional appearance
✅ Reduces "time not available" complaints
✅ Increases booking conversion rate
✅ Scales to any team size
✅ Competitive advantage

---

**Conclusion**: The professional availability counting system provides clear, real-time visibility into capacity across the entire platform, helping users make informed booking decisions while giving professionals powerful insights into their business operations.
