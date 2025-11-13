import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, parseISO } from 'date-fns';
import { ptLocale } from '../../i18n';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, AlertCircle, CheckCircle, X } from 'lucide-react';

interface BlockedDate {
  id: string;
  date: string;
  reason: string;
}

export function BlockedDates() {
  const { profile } = useAuthStore();
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBlockedDate, setNewBlockedDate] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    reason: ''
  });

  useEffect(() => {
    if (profile?.id) {
      fetchBlockedDates();
    }
  }, [profile?.id]);

  const fetchBlockedDates = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('professional_id', profile.id)
        .order('date', { ascending: true });

      if (error) throw error;
      setBlockedDates(data || []);
    } catch (err) {
      console.error('Error fetching blocked dates:', err);
      setError('Erro ao carregar datas bloqueadas');
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

  const handleAddBlockedDate = async () => {
    if (!profile?.id) return;

    setError('');
    setSuccess('');

    try {
      if (!newBlockedDate.reason.trim()) {
        throw new Error('Por favor, indique o motivo do bloqueio');
      }

      const { error } = await supabase
        .from('blocked_dates')
        .insert({
          professional_id: profile.id,
          date: newBlockedDate.date,
          reason: newBlockedDate.reason
        });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Esta data já está bloqueada');
        }
        throw error;
      }

      setSuccess('Data bloqueada com sucesso');
      setShowAddModal(false);
      setNewBlockedDate({
        date: format(new Date(), 'yyyy-MM-dd'),
        reason: ''
      });
      fetchBlockedDates();
    } catch (err: any) {
      console.error('Error adding blocked date:', err);
      setError(err.message || 'Erro ao bloquear data');
    }
  };

  const handleRemoveBlockedDate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('blocked_dates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setSuccess('Data desbloqueada com sucesso');
      fetchBlockedDates();
    } catch (err) {
      console.error('Error removing blocked date:', err);
      setError('Erro ao desbloquear data');
    }
  };

  const isDateBlocked = (date: Date) => {
    return blockedDates.some(blocked =>
      isSameDay(parseISO(blocked.date), date)
    );
  };

  const getBlockedDateReason = (date: Date) => {
    const blocked = blockedDates.find(b =>
      isSameDay(parseISO(b.date), date)
    );
    return blocked;
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Datas Bloqueadas</h1>
          <p className="text-gray-600 mt-2">Bloqueie datas em que não está disponível (férias, feriados, etc.)</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-gradient inline-flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Bloquear Data
        </button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4 flex items-start">
          <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 mr-3" />
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      <div className="card-gradient p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={handlePreviousMonth}
            className="p-2 hover:bg-blue-50 rounded-full transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-gray-600" />
          </button>
          <h2 className="text-xl font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy', { locale: ptLocale })}
          </h2>
          <button
            onClick={handleNextMonth}
            className="p-2 hover:bg-blue-50 rounded-full transition-colors"
          >
            <ChevronRight className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 mb-2">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(day => (
            <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: paddingDays }).map((_, index) => (
            <div key={`padding-${index}`} className="aspect-square" />
          ))}

          {daysInMonth.map(day => {
            const isBlocked = isDateBlocked(day);
            const blockedInfo = getBlockedDateReason(day);
            const isToday = isSameDay(day, new Date());
            const isPast = day < new Date() && !isToday;

            return (
              <div
                key={day.toISOString()}
                className={`
                  aspect-square p-2 rounded-lg border-2 transition-all
                  ${isBlocked
                    ? 'bg-red-100 border-red-300 hover:bg-red-200'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                  }
                  ${isToday ? 'ring-2 ring-blue-500' : ''}
                  ${isPast ? 'opacity-50' : ''}
                  cursor-pointer
                `}
                title={blockedInfo ? blockedInfo.reason : ''}
                onClick={() => {
                  if (isBlocked && blockedInfo) {
                    if (confirm(`Desbloquear ${format(day, 'dd/MM/yyyy')}?\nMotivo: ${blockedInfo.reason}`)) {
                      handleRemoveBlockedDate(blockedInfo.id);
                    }
                  }
                }}
              >
                <div className="flex flex-col h-full justify-between">
                  <div className={`text-sm font-medium ${isBlocked ? 'text-red-700' : 'text-gray-700'}`}>
                    {format(day, 'd')}
                  </div>
                  {isBlocked && (
                    <div className="flex justify-center">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card-gradient p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Datas Bloqueadas ({blockedDates.length})
        </h3>
        <div className="space-y-2">
          {blockedDates.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              Nenhuma data bloqueada
            </p>
          ) : (
            blockedDates.map(blocked => (
              <div
                key={blocked.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <CalendarIcon className="h-5 w-5 text-red-600" />
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(parseISO(blocked.date), 'PPP', { locale: ptLocale })}
                    </p>
                    <p className="text-sm text-gray-600">{blocked.reason}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Deseja desbloquear esta data?')) {
                      handleRemoveBlockedDate(blocked.id);
                    }
                  }}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Desbloquear data"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Bloquear Data</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data
                </label>
                <input
                  type="date"
                  value={newBlockedDate.date}
                  onChange={(e) => setNewBlockedDate({ ...newBlockedDate, date: e.target.value })}
                  min={format(new Date(), 'yyyy-MM-dd')}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo
                </label>
                <textarea
                  value={newBlockedDate.reason}
                  onChange={(e) => setNewBlockedDate({ ...newBlockedDate, reason: e.target.value })}
                  rows={3}
                  placeholder="Ex: Férias, Feriado, Compromisso pessoal..."
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddBlockedDate}
                  className="btn-gradient inline-flex items-center"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Bloquear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card-gradient p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-2">Informações:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Clique numa data bloqueada no calendário para a desbloquear</li>
              <li>Datas bloqueadas não permitem agendamentos</li>
              <li>Use para férias, feriados ou qualquer dia que não esteja disponível</li>
              <li>Pode bloquear datas futuras com antecedência</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
