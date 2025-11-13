import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO, parse } from 'date-fns';
import { ptLocale } from '../../i18n';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, AlertCircle, CheckCircle, X, Clock, Ban } from 'lucide-react';

interface BlockedTimeSlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  reason: string | null;
}

export function BlockedTimeSlots() {
  const { profile } = useAuthStore();
  const [blockedSlots, setBlockedSlots] = useState<BlockedTimeSlot[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBlockedSlot, setNewBlockedSlot] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '10:00',
    reason: ''
  });

  useEffect(() => {
    if (profile?.id) {
      fetchBlockedSlots();
    }
  }, [profile?.id]);

  const fetchBlockedSlots = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('blocked_time_slots')
        .select('*')
        .eq('professional_id', profile.id)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      setBlockedSlots(data || []);
    } catch (err) {
      console.error('Error fetching blocked time slots:', err);
      setError('Erro ao carregar horários bloqueados');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleAddBlockedSlot = async () => {
    if (!profile?.id) return;

    setError('');
    setSuccess('');

    try {
      if (!newBlockedSlot.reason.trim()) {
        throw new Error('Por favor, indique o motivo do bloqueio');
      }

      if (newBlockedSlot.start_time >= newBlockedSlot.end_time) {
        throw new Error('A hora de fim deve ser posterior à hora de início');
      }

      const { error } = await supabase
        .from('blocked_time_slots')
        .insert({
          professional_id: profile.id,
          date: newBlockedSlot.date,
          start_time: newBlockedSlot.start_time,
          end_time: newBlockedSlot.end_time,
          reason: newBlockedSlot.reason
        });

      if (error) {
        if (error.message.includes('sobreposto')) {
          throw new Error('Já existe um bloqueio que se sobrepõe a este horário');
        }
        throw error;
      }

      setSuccess('Horário bloqueado com sucesso');
      setShowAddModal(false);
      setNewBlockedSlot({
        date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '09:00',
        end_time: '10:00',
        reason: ''
      });
      fetchBlockedSlots();
    } catch (err: any) {
      console.error('Error adding blocked time slot:', err);
      setError(err.message || 'Erro ao bloquear horário');
    }
  };

  const handleRemoveBlockedSlot = async (id: string) => {
    try {
      const { error } = await supabase
        .from('blocked_time_slots')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccess('Horário desbloqueado com sucesso');
      fetchBlockedSlots();
    } catch (err) {
      console.error('Error removing blocked time slot:', err);
      setError('Erro ao desbloquear horário');
    }
  };

  const getSlotsForDate = (date: Date) => {
    return blockedSlots.filter(slot =>
      isSameDay(parseISO(slot.date), date)
    );
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startDayOfWeek = monthStart.getDay();
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
              <Ban className="h-6 w-6 text-white" />
            </div>
            <span>Bloqueio de Horários</span>
          </h1>
          <p className="text-gray-600 mt-2 ml-13">Bloqueie horários específicos dentro de um dia (ex: almoço, reunião, pausa)</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-gradient inline-flex items-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
        >
          <Plus className="h-5 w-5 mr-2" />
          Bloquear Horário
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-gradient-to-r from-red-50 to-red-100 p-4 flex items-start border-2 border-red-300 shadow-sm">
          <div className="h-6 w-6 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0 mr-3 shadow-sm">
            <AlertCircle className="h-4 w-4 text-white" />
          </div>
          <div className="text-sm text-red-700 font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-gradient-to-r from-green-50 to-emerald-100 p-4 flex items-start border-2 border-green-300 shadow-sm">
          <div className="h-6 w-6 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0 mr-3 shadow-sm">
            <CheckCircle className="h-4 w-4 text-white" />
          </div>
          <div className="text-sm text-green-700 font-medium">{success}</div>
        </div>
      )}

      <div className="card-gradient p-6 shadow-xl border-2 border-gray-200 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePreviousMonth}
            className="p-2.5 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <ChevronLeft className="h-6 w-6 text-gray-600" />
          </button>
          <h2 className="text-2xl font-black text-gray-900 flex items-center space-x-2">
            <CalendarIcon className="h-6 w-6 text-blue-600" />
            <span>{format(currentMonth, 'MMMM yyyy', { locale: ptLocale })}</span>
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2.5 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <ChevronRight className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
            <div key={day} className="text-center text-sm font-black text-gray-700 py-3 uppercase tracking-wide bg-gradient-to-b from-gray-50 to-white rounded-lg">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: paddingDays }).map((_, index) => (
            <div key={`padding-${index}`} className="aspect-square" />
          ))}

          {daysInMonth.map(day => {
            const daySlots = getSlotsForDate(day);
            const isToday = isSameDay(day, new Date());
            const isPast = day < new Date() && !isToday;

            return (
              <div
                key={day.toISOString()}
                className={`
                  aspect-square p-2 rounded-xl border-2 transition-all duration-200
                  ${daySlots.length > 0
                    ? 'bg-gradient-to-br from-red-100 to-orange-100 border-red-300 hover:shadow-lg hover:scale-105'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md'
                  }
                  ${isToday ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                  ${isPast ? 'opacity-50' : ''}
                  cursor-pointer
                `}
              >
                <div className="flex flex-col h-full justify-between">
                  <div className={`text-sm font-bold ${daySlots.length > 0 ? 'text-red-700' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>
                  {daySlots.length > 0 && (
                    <div className="space-y-1">
                      {daySlots.slice(0, 2).map(slot => (
                        <div key={slot.id} className="bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded truncate shadow-sm">
                          {slot.start_time.substring(0, 5)}-{slot.end_time.substring(0, 5)}
                        </div>
                      ))}
                      {daySlots.length > 2 && (
                        <div className="text-[8px] text-red-700 font-bold text-center bg-red-200 rounded py-0.5">
                          +{daySlots.length - 2}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card-gradient p-6 shadow-xl border-2 border-gray-200 rounded-2xl">
        <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center space-x-2">
          <Clock className="h-6 w-6 text-blue-600" />
          <span>Horários Bloqueados ({blockedSlots.length})</span>
        </h3>
        <div className="space-y-2">
          {blockedSlots.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex flex-col items-center space-y-3">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
                  <Clock className="h-10 w-10 text-gray-400" />
                </div>
                <p className="text-gray-600 font-semibold">Nenhum horário bloqueado</p>
                <p className="text-sm text-gray-500">Clique em "Bloquear Horário" para adicionar</p>
              </div>
            </div>
          ) : (
            blockedSlots.map(slot => (
              <div
                key={slot.id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl hover:shadow-lg transition-all duration-200 border-2 border-gray-200 hover:border-blue-300"
              >
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-md">
                    <Ban className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 flex items-center space-x-2">
                      <span>{format(parseISO(slot.date), 'PPP', { locale: ptLocale })}</span>
                    </p>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-sm font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-lg">
                        {slot.start_time.substring(0, 5)} - {slot.end_time.substring(0, 5)}
                      </span>
                      {slot.reason && (
                        <span className="text-sm text-gray-600">· {slot.reason}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Deseja desbloquear este horário?')) {
                      handleRemoveBlockedSlot(slot.id);
                    }
                  }}
                  className="p-3 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 border-2 border-transparent hover:border-red-300"
                  title="Desbloquear horário"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border-2 border-gray-200 animate-in zoom-in duration-200">
            <div className="flex justify-between items-center p-6 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-cyan-50">
              <h2 className="text-2xl font-black text-gray-900 flex items-center space-x-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <span>Bloquear Horário</span>
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-white/50 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={newBlockedSlot.date}
                  onChange={(e) => setNewBlockedSlot({ ...newBlockedSlot, date: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="block w-full rounded-xl border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 px-4 py-3 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Hora Início
                  </label>
                  <input
                    type="time"
                    value={newBlockedSlot.start_time}
                    onChange={(e) => setNewBlockedSlot({ ...newBlockedSlot, start_time: e.target.value })}
                    className="block w-full rounded-xl border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 px-4 py-3 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Hora Fim
                  </label>
                  <input
                    type="time"
                    value={newBlockedSlot.end_time}
                    onChange={(e) => setNewBlockedSlot({ ...newBlockedSlot, end_time: e.target.value })}
                    className="block w-full rounded-xl border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 px-4 py-3 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Motivo
                </label>
                <textarea
                  value={newBlockedSlot.reason}
                  onChange={(e) => setNewBlockedSlot({ ...newBlockedSlot, reason: e.target.value })}
                  rows={3}
                  placeholder="Ex: Pausa para almoço, Reunião, Compromisso pessoal..."
                  className="block w-full rounded-xl border-2 border-gray-300 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 px-4 py-3"
                />
              </div>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <strong>Nota:</strong> O sistema não permitirá criar reservas em horários bloqueados. Isto é útil para pausas, reuniões ou compromissos pessoais.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t-2 border-gray-200">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-2.5 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all duration-200 font-bold hover:scale-105 active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddBlockedSlot}
                  className="btn-gradient inline-flex items-center px-5 py-2.5 shadow-lg hover:shadow-xl"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Bloquear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card-gradient p-6 bg-gradient-to-r from-blue-50 via-cyan-50 to-blue-50 border-2 border-blue-200 rounded-2xl shadow-lg">
        <div className="flex items-start space-x-3">
          <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <AlertCircle className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-bold mb-3 text-blue-900 text-lg">Informações Importantes:</p>
            <ul className="list-disc list-inside space-y-2 text-sm text-blue-800">
              <li><strong>Horários bloqueados</strong> impedem clientes de fazer reservas naqueles períodos específicos</li>
              <li>Use para <strong>pausas de almoço, reuniões ou compromissos</strong> que ocupem apenas parte do dia</li>
              <li>Para bloquear o <strong>dia inteiro</strong>, use a funcionalidade "Datas Bloqueadas" no menu</li>
              <li>Não é possível criar bloqueios sobrepostos no mesmo horário</li>
              <li>Pode gerir e remover bloqueios a qualquer momento</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
