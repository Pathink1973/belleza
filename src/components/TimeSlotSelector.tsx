import { Clock, Sunrise, Sun, Moon, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface TimeSlot {
  time: string;
  isAvailable: boolean;
  availableProfessionals?: {
    unique_id: string;
    profile_id: string | null;
    team_member_id: string | null;
    full_name: string;
    avatar_url: string | null;
    is_primary: boolean;
  }[];
}

interface TimeSlotSelectorProps {
  timeSlots: TimeSlot[];
  selectedTime: string;
  onTimeSelect: (time: string) => void;
  onSlotClick?: (slot: TimeSlot) => void;
  showProfessionalCount?: boolean;
}

const TIME_PERIODS = [
  {
    label: 'Manhã',
    start: '09:00',
    end: '12:00',
    gradient: 'from-amber-100 via-orange-50 to-yellow-100',
    bgGradient: 'from-amber-500/10 to-orange-500/10',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
    icon: Sunrise
  },
  {
    label: 'Tarde',
    start: '12:00',
    end: '17:00',
    gradient: 'from-sky-100 via-blue-50 to-cyan-100',
    bgGradient: 'from-sky-500/10 to-cyan-500/10',
    borderColor: 'border-sky-300',
    textColor: 'text-sky-700',
    icon: Sun
  },
  {
    label: 'Noite',
    start: '17:00',
    end: '20:00',
    gradient: 'from-slate-100 via-gray-50 to-blue-100',
    bgGradient: 'from-slate-500/10 to-blue-500/10',
    borderColor: 'border-slate-300',
    textColor: 'text-slate-700',
    icon: Moon
  },
];

export function TimeSlotSelector({ timeSlots, selectedTime, onTimeSelect, onSlotClick, showProfessionalCount = false }: TimeSlotSelectorProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);

  const isTimeInPeriod = (time: string, start: string, end: string) => {
    return time >= start && time < end;
  };

  const getFilteredSlots = () => {
    if (!selectedPeriod) return timeSlots;

    const period = TIME_PERIODS.find(p => p.label === selectedPeriod);
    if (!period) return timeSlots;

    return timeSlots.filter(slot => isTimeInPeriod(slot.time, period.start, period.end));
  };

  const filteredSlots = getFilteredSlots();
  const availableCount = filteredSlots.filter(s => s.isAvailable).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <div>
            <label className="block text-xl font-bold text-gray-900">
              Selecionar Horário
            </label>
            <p className="text-sm text-gray-500 mt-1">Escolha o melhor horário para si</p>
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-cyan-50 px-5 py-3 rounded-xl border border-blue-200 shadow-sm">
          <Sparkles className="h-5 w-5 text-blue-600" />
          <span className="text-lg font-bold text-blue-900">{availableCount}</span>
          <span className="text-sm text-blue-700 font-medium">disponíveis</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {TIME_PERIODS.map((period) => {
          const periodSlots = timeSlots.filter(slot =>
            isTimeInPeriod(slot.time, period.start, period.end)
          );
          const periodAvailable = periodSlots.filter(s => s.isAvailable).length;
          const isSelected = selectedPeriod === period.label;
          const IconComponent = period.icon;

          return (
            <button
              key={period.label}
              type="button"
              onClick={() => setSelectedPeriod(isSelected ? null : period.label)}
              className={`
                group relative overflow-hidden rounded-2xl p-4 sm:p-5 text-left transition-all duration-300 transform min-h-[140px] sm:min-h-[150px] touch-manipulation
                ${isSelected
                  ? 'ring-2 ring-blue-500 shadow-xl scale-105 -translate-y-1'
                  : 'hover:shadow-lg hover:scale-102 hover:-translate-y-0.5'
                }
                ${periodAvailable === 0 ? 'opacity-60 cursor-not-allowed' : ''}
              `}
              disabled={periodAvailable === 0}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${period.gradient} transition-opacity duration-300 ${isSelected ? 'opacity-100' : 'opacity-70 group-hover:opacity-90'}`} />
              <div className={`absolute inset-0 bg-gradient-to-br ${period.bgGradient} opacity-0 ${isSelected ? 'opacity-100' : 'group-hover:opacity-50'} transition-opacity duration-300`} />
              <div className="relative space-y-3">
                <div className="flex items-center justify-between">
                  <div className={`h-10 w-10 rounded-lg bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-sm ${isSelected ? 'scale-110' : 'group-hover:scale-105'} transition-transform duration-200`}>
                    <IconComponent className={`h-5 w-5 ${period.textColor}`} />
                  </div>
                  {isSelected && (
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
                  )}
                </div>
                <div>
                  <div className={`text-base font-bold ${period.textColor}`}>{period.label}</div>
                  <div className="text-sm text-gray-600 font-medium mt-1">{period.start} - {period.end}</div>
                </div>
                <div className={`flex items-center space-x-1 pt-2 border-t ${period.borderColor} border-opacity-30`}>
                  {periodAvailable > 0 ? (
                    <>
                      <div className={`flex-1 text-sm font-bold ${period.textColor}`}>
                        {periodAvailable} {periodAvailable === 1 ? 'horário' : 'horários'}
                      </div>
                      <div className={`text-xs px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm font-semibold ${period.textColor}`}>
                        Disponível
                      </div>
                    </>
                  ) : (
                    <div className="text-sm font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                      Esgotado
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 rounded-2xl p-4 sm:p-6 border-2 border-gray-200 shadow-inner">
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 max-h-96 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-gray-100 rounded-xl">
          {filteredSlots.map((slot, index) => {
            const isSelected = selectedTime === slot.time;

            return (
              <button
                key={index}
                type="button"
                disabled={!slot.isAvailable}
                onClick={() => {
                  if (onSlotClick) {
                    onSlotClick(slot);
                  } else {
                    onTimeSelect(slot.time);
                  }
                }}
                className={`
                  relative py-4 px-3 rounded-xl text-base font-semibold transition-all duration-300 group transform min-h-[72px] touch-manipulation
                  ${isSelected
                    ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white shadow-xl scale-105 ring-2 ring-blue-400 ring-offset-2 -translate-y-1'
                    : slot.isAvailable
                      ? 'bg-white text-gray-700 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:text-blue-700 hover:shadow-lg hover:scale-105 hover:-translate-y-0.5 border-2 border-gray-200 hover:border-blue-300'
                      : 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-400 cursor-not-allowed border-2 border-gray-300 opacity-50'
                  }
                `}
                title={!slot.isAvailable ? 'Horário esgotado - todos os profissionais ocupados' : 'Clique para selecionar este horário'}
              >
                <div className="flex flex-col items-center space-y-1.5">
                  <span className={`text-lg ${isSelected ? 'font-extrabold tracking-tight' : 'font-bold'} ${!slot.isAvailable ? 'line-through opacity-50' : ''}`}>
                    {slot.time}
                  </span>
                  {showProfessionalCount && slot.availableProfessionals && slot.availableProfessionals.length > 0 && (
                    <div className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      isSelected
                        ? 'bg-white/25 text-white'
                        : 'bg-blue-100 text-blue-700 group-hover:bg-blue-200'
                    }`}>
                      <span>{slot.availableProfessionals.length}</span>
                      <span className="opacity-75">{slot.availableProfessionals.length === 1 ? 'prof' : 'profs'}</span>
                    </div>
                  )}
                  {!slot.isAvailable && (
                    <span className="text-xs text-red-700 font-bold bg-red-100 px-2.5 py-1 rounded-full">
                      Ocupado
                    </span>
                  )}
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 flex items-center justify-center">
                      <div className="absolute w-5 h-5 bg-green-400 rounded-full animate-ping opacity-75" />
                      <div className="relative w-4 h-4 bg-green-500 rounded-full shadow-lg" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {filteredSlots.length === 0 && (
          <div className="col-span-full text-center py-12">
            <div className="inline-flex flex-col items-center space-y-3">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                <Clock className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Nenhum horário disponível</p>
              <p className="text-xs text-gray-500">Tente selecionar outro período do dia</p>
            </div>
          </div>
        )}
      </div>

      {selectedTime && (
        <div className="relative overflow-hidden bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 sm:p-7 shadow-xl border-2 border-green-400 animate-in slide-in-from-bottom duration-500">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          <div className="relative flex flex-col sm:flex-row items-center sm:justify-between gap-4">
            <div className="flex items-center space-x-4 sm:space-x-5">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-white/90 uppercase tracking-wider mb-2">Horário Confirmado</div>
                <div className="text-4xl sm:text-5xl font-black text-white tracking-tight">{selectedTime}</div>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-40" />
                <div className="relative h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <Sparkles className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
