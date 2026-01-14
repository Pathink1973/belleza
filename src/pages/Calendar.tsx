import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { CleanupModal } from '../components/CleanupModal';
import { MonthlyCalendar } from '../components/MonthlyCalendar';
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { ptLocale } from '../i18n';
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Save,
  Edit,
  Check,
  Archive,
  Trash2,
  Download,
  Eye,
  EyeOff,
  LayoutGrid,
  List,
  UtensilsCrossed,
  Coffee,
  Users as UsersIcon,
  Ban,
  Lock
} from 'lucide-react';
import { InfoCard } from '../components/InfoCard';
import { formatCurrency } from '../utils/currency';
import { confirmBookingWithCapacityCheck } from '../utils/availability';

interface TimeSlot {
  time: string;
  available: boolean;
  note: string;
  isOptIn: boolean;
}

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: 'pendente' | 'confirmado' | 'concluído' | 'cancelado';
  booking_type?: 'reserva' | 'bloqueio';
  block_reason?: string;
  team_member_id?: string | null;
  service: {
    title: string;
    price: number;
    duration: string;
  };
  team_member?: {
    name: string;
  } | null;
  client: {
    full_name: string;
    avatar_url: string | null;
    mobile_number: string;
  } | null;
}

interface CalendarNote {
  id: string;
  note: string;
  is_opt_in: boolean;
}

const getBlockIcon = (blockReason?: string) => {
  if (!blockReason) return Ban;

  const lowerReason = blockReason.toLowerCase();
  if (lowerReason.includes('almoço') || lowerReason.includes('almoco')) return UtensilsCrossed;
  if (lowerReason.includes('pausa') || lowerReason.includes('café') || lowerReason.includes('cafe')) return Coffee;
  if (lowerReason.includes('reunião') || lowerReason.includes('reuniao')) return UsersIcon;
  return Ban;
};

const getBlockColorClasses = (blockReason?: string) => {
  if (!blockReason) return { bg: 'bg-amber-100', border: 'border-amber-400', gradient: 'from-amber-50 to-orange-50', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-800' };

  const lowerReason = blockReason.toLowerCase();
  if (lowerReason.includes('almoço') || lowerReason.includes('almoco')) {
    return { bg: 'bg-orange-100', border: 'border-orange-400', gradient: 'from-orange-50 to-amber-50', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' };
  }
  if (lowerReason.includes('pausa') || lowerReason.includes('café') || lowerReason.includes('cafe')) {
    return { bg: 'bg-amber-100', border: 'border-amber-400', gradient: 'from-amber-50 to-yellow-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-800' };
  }
  if (lowerReason.includes('reunião') || lowerReason.includes('reuniao')) {
    return { bg: 'bg-blue-100', border: 'border-blue-400', gradient: 'from-blue-50 to-cyan-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-800' };
  }
  return { bg: 'bg-yellow-100', border: 'border-yellow-400', gradient: 'from-yellow-50 to-orange-50', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' };
};

export function Calendar() {
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [slotNotes, setSlotNotes] = useState<Record<string, { note: string; isOptIn: boolean }>>({});
  const [showArchived, setShowArchived] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
  const [monthlyBookings, setMonthlyBookings] = useState<Booking[]>([]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const timeSlots: TimeSlot[] = [];
  for (let hour = 9; hour <= 19; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === 19 && minute > 30) break;
      const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      timeSlots.push({
        time,
        available: true,
        note: slotNotes[time]?.note || '',
        isOptIn: slotNotes[time]?.isOptIn || false
      });
    }
  }

  useEffect(() => {
    if (viewMode === 'day') {
      fetchBookings();
      fetchNotes();
    } else {
      fetchMonthlyBookings();
    }
  }, [selectedDate, user, showArchived, viewMode]);

  const fetchMonthlyBookings = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError('');
      const monthStart = startOfMonth(selectedDate);
      const monthEnd = endOfMonth(selectedDate);

      let query = supabase
        .from('bookings')
        .select(`
          *,
          booking_type,
          block_reason,
          service:services(title, price, duration, team),
          team_member:service_team_members!bookings_team_member_id_fkey(name),
          professional:profiles!bookings_professional_id_fkey(full_name),
          client:profiles!bookings_client_id_fkey(
            full_name,
            avatar_url,
            mobile_number
          )
        `)
        .eq('professional_id', user.id)
        .gte('start_time', monthStart.toISOString())
        .lte('start_time', monthEnd.toISOString());

      if (!showArchived) {
        query = query.in('status', ['pendente', 'confirmado']);
      }

      query = query.order('start_time');

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching monthly bookings:', error);
        throw new Error(`Erro ao carregar agendamentos: ${error.message}`);
      }

      const validBookings = (data || []).filter(booking => {
        if (!booking.client) {
          console.warn('Booking with missing client data:', booking.id);
        }
        if (!booking.service) {
          console.warn('Booking with missing service data:', booking.id);
          return false;
        }
        return true;
      });

      setMonthlyBookings(validBookings);

      const { count, error: countError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', user.id)
        .in('status', ['concluído', 'cancelado']);

      if (countError) {
        console.error('Error fetching archived count:', countError);
      } else {
        setArchivedCount(count || 0);
      }
    } catch (err: any) {
      console.error('Error fetching monthly bookings:', err);
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint
      });
      setError(err?.message || 'Erro ao carregar agendamentos do mês');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError('');
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from('bookings')
        .select(`
          *,
          booking_type,
          block_reason,
          service:services(title, price, duration, team),
          team_member:service_team_members!bookings_team_member_id_fkey(name),
          professional:profiles!bookings_professional_id_fkey(full_name),
          client:profiles!bookings_client_id_fkey(
            full_name,
            avatar_url,
            mobile_number
          )
        `)
        .eq('professional_id', user.id)
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString());

      if (!showArchived) {
        query = query.in('status', ['pendente', 'confirmado']);
      }

      query = query.order('start_time');

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching bookings:', error);
        throw new Error(`Erro ao carregar agendamentos: ${error.message}`);
      }

      const validBookings = (data || []).filter(booking => {
        if (!booking.client) {
          console.warn('Booking with missing client data:', booking.id);
        }
        if (!booking.service) {
          console.warn('Booking with missing service data:', booking.id);
          return false;
        }
        return true;
      });

      setBookings(validBookings);

      const { count, error: countError } = await supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', user.id)
        .in('status', ['concluído', 'cancelado']);

      if (countError) {
        console.error('Error fetching archived count:', countError);
      } else {
        setArchivedCount(count || 0);
      }
    } catch (err: any) {
      console.error('Error fetching bookings:', err);
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint
      });
      setError(err?.message || 'Erro ao carregar agendamentos');
    } finally {
      setLoading(false);
    }
  };

  const fetchNotes = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('calendar_notes')
        .select('*')
        .eq('professional_id', user.id)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'));

      if (error) throw error;

      const notes: Record<string, { note: string; isOptIn: boolean }> = {};
      data?.forEach(note => {
        notes[note.time_slot] = {
          note: note.note,
          isOptIn: note.is_opt_in
        };
      });
      setSlotNotes(notes);
    } catch (err: any) {
      console.error('Error fetching notes:', err);
      console.error('Error details:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint
      });
      setError('Erro ao carregar notas');
    }
  };

  const handlePreviousWeek = () => {
    setWeekStart(subWeeks(weekStart, 1));
  };

  const handleNextWeek = () => {
    setWeekStart(addWeeks(weekStart, 1));
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
  };

  const isDateSelected = (date: Date) => {
    return format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
  };

  const handleBookingClick = (booking: Booking) => {
    setSelectedBooking(booking);
  };

  const handleBookingAction = async (bookingId: string, newStatus: Booking['status']) => {
    try {
      setError('');
      setSuccess('');

      if (newStatus === 'confirmado') {
        console.log('[CONFIRMATION] Confirming booking with capacity check:', bookingId);

        const result = await confirmBookingWithCapacityCheck(bookingId);

        if (!result.success) {
          setError(result.message);
          console.error('[CONFIRMATION] Cannot confirm booking:', result.message);
          return;
        }

        if (result.assignedTo) {
          setSuccess(`Agendamento confirmado! Atribuído a: ${result.assignedTo}`);
        } else {
          setSuccess('Agendamento confirmado com sucesso!');
        }

        console.log('[CONFIRMATION] Booking confirmed successfully');
      } else {
        const { error } = await supabase
          .from('bookings')
          .update({ status: newStatus })
          .eq('id', bookingId);

        if (error) throw error;

        const statusMessage = newStatus === 'concluído' ? 'concluído' : 'cancelado';
        setSuccess(`Agendamento ${statusMessage} com sucesso`);
      }

      setSelectedBooking(null);

      setTimeout(() => {
        fetchBookings();
      }, 300);
    } catch (err: any) {
      console.error('Error updating booking:', err);
      const errorMessage = err?.message || 'Erro ao atualizar agendamento';
      setError(errorMessage);
    }
  };

  const getStatusColor = (status: Booking['status']) => {
    switch (status) {
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmado':
        return 'bg-blue-100 text-blue-800';
      case 'concluído':
        return 'bg-green-100 text-green-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const handleWhatsAppClick = (mobileNumber: string, serviceName: string) => {
    const message = `Olá! Gostaria de confirmar seu agendamento para ${serviceName}. Podemos confirmar o horário?`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${mobileNumber}?text=${encodedMessage}`, '_blank');
  };

  const handleSlotEdit = (time: string) => {
    setEditingSlot(time);
  };

  const handleSlotSave = async (time: string) => {
    if (!user?.id) return;

    try {
      const note = slotNotes[time]?.note || '';
      const isOptIn = slotNotes[time]?.isOptIn || false;

      const { error } = await supabase
        .from('calendar_notes')
        .upsert({
          professional_id: user.id,
          date: format(selectedDate, 'yyyy-MM-dd'),
          time_slot: time,
          note,
          is_opt_in: isOptIn
        }, {
          onConflict: 'professional_id,date,time_slot'
        });

      if (error) throw error;
      setEditingSlot(null);
      setSuccess('Nota salva com sucesso');
    } catch (err) {
      console.error('Error saving note:', err);
      setError('Erro ao salvar nota');
    }
  };

  const handleSlotNoteChange = (time: string, note: string) => {
    setSlotNotes(prev => ({
      ...prev,
      [time]: {
        note,
        isOptIn: prev[time]?.isOptIn || false
      }
    }));
  };

  const handleOptInChange = (time: string) => {
    setSlotNotes(prev => ({
      ...prev,
      [time]: {
        note: prev[time]?.note || '',
        isOptIn: !prev[time]?.isOptIn
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const activeBookingsCount = bookings.filter(b => ['pendente', 'confirmado'].includes(b.status)).length;

  return (
    <div className="space-y-2 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <h1 className="text-lg sm:text-3xl font-bold text-gray-900">Calendário</h1>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 w-full sm:w-auto">
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5 sm:p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center space-x-1 sm:space-x-2 px-1.5 sm:px-4 py-1 sm:py-2 rounded-md transition-all ${
                viewMode === 'month'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <LayoutGrid className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-[11px] sm:text-sm font-medium">Mês</span>
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center space-x-1 sm:space-x-2 px-1.5 sm:px-4 py-1 sm:py-2 rounded-md transition-all ${
                viewMode === 'day'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-[11px] sm:text-sm font-medium">Dia</span>
            </button>
          </div>
          <button
            onClick={() => {
              setShowArchived(!showArchived);
              setError('');
            }}
            className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg transition-all ${
              showArchived
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
            disabled={loading}
          >
            {showArchived ? <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Eye className="h-3 w-3 sm:h-4 sm:w-4" />}
            <span className="text-[11px] sm:text-sm font-medium">
              {showArchived ? 'Ocultar' : 'Arquivadas'}
            </span>
            {!showArchived && archivedCount > 0 && (
              <span className="bg-gray-200 text-gray-700 px-1 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-xs font-semibold">
                {archivedCount}
              </span>
            )}
          </button>
          {archivedCount > 0 && (
            <button
              onClick={() => setShowCleanupModal(true)}
              className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1 sm:py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
            >
              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-[11px] sm:text-sm font-medium">Limpar</span>
            </button>
          )}
        </div>
      </div>

      {!showArchived && viewMode === 'day' && (
        <div className="space-y-2 sm:space-y-3">
          <InfoCard variant="subtle" className="p-2 sm:p-3">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Archive className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
              <p className="text-[10px] leading-tight sm:text-xs text-gray-700">
                <strong className="text-gray-800">Reservas ativas:</strong> {activeBookingsCount} {activeBookingsCount === 1 ? 'reserva' : 'reservas'}.
                {archivedCount > 0 && ` ${archivedCount} arquivada${archivedCount !== 1 ? 's' : ''} oculta${archivedCount !== 1 ? 's' : ''}.`}
              </p>
            </div>
          </InfoCard>
          <InfoCard variant="subtle" dismissible={true} storageKey="calendar-blocking-info-seen" className="p-2 sm:p-3">
            <div className="flex items-start space-x-1 sm:space-x-2 pr-6">
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-[10px] leading-tight sm:text-xs text-gray-700">
                <p className="font-semibold mb-0.5 text-gray-800">Bloqueio Inteligente</p>
                <p>
                  <strong className="text-gray-800">Confirmadas</strong> bloqueiam horários. <strong className="text-gray-800">Pendentes</strong> não bloqueiam.
                </p>
              </div>
            </div>
          </InfoCard>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      {viewMode === 'month' ? (
        <>
          {!showArchived && (
            <InfoCard variant="subtle" dismissible={true} storageKey="calendar-month-blocking-info-seen" className="p-2 sm:p-3 mb-2 sm:mb-4">
              <div className="flex items-start space-x-1 sm:space-x-2 pr-6">
                <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-[10px] leading-tight sm:text-xs text-gray-700">
                  <p className="font-semibold mb-0.5 text-gray-800">Bloqueio Inteligente</p>
                  <p>
                    Apenas reservas <strong className="text-gray-800">confirmadas</strong> bloqueiam horários.
                  </p>
                </div>
              </div>
            </InfoCard>
          )}
          {loading ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 font-medium">A carregar calendário...</p>
              </div>
            </div>
          ) : monthlyBookings.length === 0 && showArchived ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
              <div className="text-center">
                <Archive className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Nenhuma reserva arquivada encontrada
                </h3>
                <p className="text-gray-600">
                  Reservas concluídas e canceladas aparecerão aqui quando existirem.
                </p>
              </div>
            </div>
          ) : (
            <MonthlyCalendar
              bookings={monthlyBookings}
              onDateClick={(date) => {
                setSelectedDate(date);
                setViewMode('day');
              }}
              selectedDate={selectedDate}
              showArchived={showArchived}
            />
          )}
        </>
      ) : (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-2 sm:p-6">
        <div className="flex items-center justify-between mb-2 sm:mb-6">
          <button
            onClick={handlePreviousWeek}
            className="p-1 sm:p-2 hover:bg-blue-50 rounded-full transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-600" />
          </button>
          <h2 className="text-xs sm:text-lg font-semibold text-gray-900 capitalize">
            {format(weekStart, 'MMMM yyyy', { locale: ptLocale })}
          </h2>
          <button
            onClick={handleNextWeek}
            className="p-1 sm:p-2 hover:bg-blue-50 rounded-full transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-gray-600" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-2 mb-2 sm:mb-4">
          {weekDays.map((date) => (
            <button
              key={date.toISOString()}
              onClick={() => handleDateClick(date)}
              className={`
                p-1 sm:p-3 rounded sm:rounded-lg text-center transition-all
                ${isDateSelected(date)
                  ? 'bg-blue-600 text-white shadow-md scale-105'
                  : 'hover:bg-blue-50 hover:scale-102'
                }
              `}
            >
              <div className="text-[9px] sm:text-sm font-medium leading-tight">
                {format(date, 'EEE', { locale: ptLocale })}
              </div>
              <div className="text-xs sm:text-lg font-semibold leading-tight">
                {format(date, 'd')}
              </div>
            </button>
          ))}
        </div>

        {bookings.length === 0 && showArchived ? (
          <div className="text-center py-6 sm:py-12">
            <Archive className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-2 sm:mb-4" />
            <p className="text-sm sm:text-base text-gray-600 font-medium">Nenhuma reserva arquivada neste dia</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">Reservas concluídas e canceladas aparecerão aqui.</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-6 sm:py-12">
            <CalendarIcon className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mb-2 sm:mb-4" />
            <p className="text-sm sm:text-base text-gray-600 font-medium">Nenhuma reserva neste dia</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">O dia está livre para agendamentos.</p>
          </div>
        ) : (
          <div className="max-h-[400px] sm:max-h-[600px] overflow-y-auto space-y-0.5 sm:space-y-1 pr-0.5 sm:pr-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            {timeSlots.map((slot, index) => {
            const slotBookings = bookings.filter(booking => {
              const bookingTime = format(parseISO(booking.start_time), 'HH:mm');
              return bookingTime === slot.time;
            });

            const confirmedBookings = slotBookings.filter(b => b.status === 'confirmado');
            const isSlotBlocked = confirmedBookings.length > 0;

            const currentHour = parseInt(slot.time.split(':')[0]);
            const showDivider = index > 0 && (currentHour === 12 || currentHour === 17);
            const periodLabel = currentHour === 12 ? 'Tarde' : currentHour === 17 ? 'Noite' : null;

            return (
              <div key={slot.time}>
                {showDivider && periodLabel && (
                  <div className="flex items-center gap-2 sm:gap-3 my-2 sm:my-3">
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                    <span className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider">{periodLabel}</span>
                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                  </div>
                )}
                <div
                  className={`flex items-center py-1.5 sm:py-2.5 px-2 sm:px-3 rounded-md sm:rounded-lg transition-colors group ${
                    isSlotBlocked
                      ? 'bg-red-50/30 border-l-2 sm:border-l-4 border-red-400'
                      : 'hover:bg-blue-50/50'
                  }`}
                >
                  <div className={`w-12 sm:w-16 flex items-center text-xs sm:text-sm ${
                    isSlotBlocked ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    <Clock className={`h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5 ${
                      isSlotBlocked ? 'text-red-500' : 'text-gray-400'
                    }`} />
                    <span className={`font-medium text-[11px] sm:text-sm ${
                      isSlotBlocked ? 'font-bold' : ''
                    }`}>{slot.time}</span>
                    {isSlotBlocked && (
                      <Lock className="ml-0.5 sm:ml-1 w-3 h-3 text-red-600" />
                    )}
                  </div>

                  <div className="flex-1 ml-2 sm:ml-3">
                    {slotBookings.length > 0 ? (
                      <div className="space-y-1.5">
                        {slotBookings.map(booking => {
                          const isArchived = ['concluído', 'cancelado'].includes(booking.status);
                          const isConfirmed = booking.status === 'confirmado';
                          const isPending = booking.status === 'pendente';
                          const isBlock = booking.booking_type === 'bloqueio';
                          const clientName = booking.client?.full_name || 'Cliente Removido';
                          const hasClientData = booking.client !== null;
                          const blockColors = isBlock ? getBlockColorClasses(booking.block_reason) : null;
                          const BlockIconComponent = isBlock ? getBlockIcon(booking.block_reason) : null;

                          return (
                          <div
                            key={booking.id}
                            onClick={() => handleBookingClick(booking)}
                            className={`flex items-center justify-between py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg shadow-sm hover:shadow-md cursor-pointer border transition-all duration-300 ease-in-out relative ${
                              isBlock
                                ? `${blockColors?.border} bg-gradient-to-r ${blockColors?.gradient}`
                                : isArchived
                                ? 'booking-archived border-gray-300 bg-gray-50'
                                : isConfirmed
                                ? 'booking-active border-blue-300 bg-blue-50/50 ring-2 ring-blue-200'
                                : isPending
                                ? 'booking-active border-yellow-300 bg-yellow-50/50'
                                : 'booking-active border-gray-100 bg-white'
                            }`}
                          >
                            {isBlock && (
                              <div className={`absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${blockColors?.text.replace('text-', 'bg-')}`} title={`Bloqueio: ${booking.block_reason || 'Indisponível'}`}></div>
                            )}
                            {!isBlock && isConfirmed && (
                              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse" title="Horário bloqueado para outros clientes"></div>
                            )}
                            {!isBlock && isPending && (
                              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-yellow-500 rounded-full" title="Aguarda confirmação - Horário ainda disponível"></div>
                            )}
                            <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                              {isBlock && BlockIconComponent ? (
                                <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center flex-shrink-0 ${blockColors?.bg}`}>
                                  <BlockIconComponent className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${blockColors?.text}`} />
                                </div>
                              ) : booking.client?.avatar_url ? (
                                <img
                                  src={booking.client.avatar_url}
                                  alt={clientName}
                                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className={`h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  hasClientData ? 'bg-blue-100' : 'bg-gray-200'
                                }`}>
                                  <User className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${hasClientData ? 'text-blue-600' : 'text-gray-400'}`} />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <h3 className={`font-medium text-xs sm:text-sm truncate ${isBlock ? blockColors?.text : 'text-gray-900'}`}>
                                  {isBlock ? (booking.block_reason || 'Bloqueio') : booking.service.title}
                                </h3>
                                <p className={`text-xs ${isBlock ? `${blockColors?.text} font-medium` : hasClientData ? 'text-gray-500' : 'text-gray-400 italic'} truncate`}>
                                  {isBlock ? `${format(parseISO(booking.start_time), 'HH:mm')} - ${format(parseISO(booking.end_time), 'HH:mm')}` : clientName}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1.5 sm:space-x-3 flex-shrink-0">
                              <span className={`px-1.5 sm:px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${isBlock ? blockColors?.badge : getStatusColor(booking.status)}`}>
                                {isBlock ? 'bloqueio' : booking.status}
                              </span>
                              {!isBlock && (
                                <div className="text-right">
                                  <p className="text-xs sm:text-sm font-semibold text-blue-600">
                                    {formatCurrency(booking.service.price)}
                                  </p>
                                  <p className="text-[10px] sm:text-xs text-gray-500">
                                    {booking.service.duration}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        {editingSlot === slot.time ? (
                          <div className="flex-1 flex items-center space-x-2">
                            <input
                              type="text"
                              value={slotNotes[slot.time]?.note || ''}
                              onChange={(e) => handleSlotNoteChange(slot.time, e.target.value)}
                              className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Adicionar nota..."
                              autoFocus
                            />
                            <div className="flex items-center space-x-2">
                              <label className="flex items-center space-x-1.5 text-xs text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={slotNotes[slot.time]?.isOptIn || false}
                                  onChange={() => handleOptInChange(slot.time)}
                                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="font-medium">Concluído</span>
                              </label>
                              <button
                                onClick={() => handleSlotSave(slot.time)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full"
                              >
                                <Save className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-gray-500 flex items-center space-x-2">
                              <span className="text-xs">{slotNotes[slot.time]?.note || 'Horário disponível'}</span>
                              {slotNotes[slot.time]?.isOptIn && (
                                <Check className="h-4 w-4 text-emerald-500" />
                              )}
                            </div>
                            <button
                              onClick={() => handleSlotEdit(slot.time)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full m-4">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Detalhes do Agendamento
              </h2>
              <button
                onClick={() => setSelectedBooking(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                {selectedBooking.client?.avatar_url ? (
                  <img
                    src={selectedBooking.client.avatar_url}
                    alt={selectedBooking.client?.full_name || 'Cliente'}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                    selectedBooking.client ? 'bg-blue-100' : 'bg-gray-200'
                  }`}>
                    <User className={`h-6 w-6 ${selectedBooking.client ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                )}
                <div>
                  <h3 className={`font-medium ${selectedBooking.client ? 'text-gray-900' : 'text-gray-500 italic'}`}>
                    {selectedBooking.client?.full_name || 'Cliente Removido'}
                  </h3>
                  {selectedBooking.client?.mobile_number && (
                    <p className="text-sm text-gray-500">
                      {selectedBooking.client.mobile_number}
                    </p>
                  )}
                  {!selectedBooking.client && (
                    <p className="text-xs text-gray-400 italic">
                      Dados do cliente indisponíveis
                    </p>
                  )}
                </div>
              </div>

              {(() => {
                const professionalName = selectedBooking.team_member?.name
                  || selectedBooking.service?.team?.find((m: any) => m.is_primary)?.name
                  || selectedBooking.professional?.full_name;

                return professionalName ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                          <User className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                            Profissional Atribuído
                          </p>
                          <p className="text-base font-bold text-gray-900">
                            {professionalName}
                          </p>
                        </div>
                      </div>
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">
                  {selectedBooking.service.title}
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Horário:</span>
                    <p className="font-medium">
                      {format(parseISO(selectedBooking.start_time), 'HH:mm')}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Duração:</span>
                    <p className="font-medium">{selectedBooking.service.duration}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Valor:</span>
                    <p className="font-medium text-blue-600">
                      {formatCurrency(selectedBooking.service.price)}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <p className={`font-medium ${getStatusColor(selectedBooking.status)}`}>
                      {selectedBooking.status}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                {selectedBooking.client?.mobile_number && (
                  <button
                    onClick={() => handleWhatsAppClick(
                      selectedBooking.client!.mobile_number,
                      selectedBooking.service.title
                    )}
                    className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-md"
                  >
                    Contactar via WhatsApp
                  </button>
                )}
                {!selectedBooking.client?.mobile_number && <div></div>}
                <div className="space-x-2">
                  {selectedBooking.status === 'pendente' && (
                    <>
                      <button
                        onClick={() => handleBookingAction(selectedBooking.id, 'confirmado')}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Confirmar
                      </button>
                      <button
                        onClick={() => handleBookingAction(selectedBooking.id, 'cancelado')}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {selectedBooking.status === 'confirmado' && (
                    <button
                      onClick={() => handleBookingAction(selectedBooking.id, 'concluído')}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Concluir
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <CleanupModal
        isOpen={showCleanupModal}
        onClose={() => setShowCleanupModal(false)}
        professionalId={user?.id || ''}
        archivedCount={archivedCount}
        onSuccess={() => {
          setSuccess(`${archivedCount} reserva${archivedCount !== 1 ? 's' : ''} arquivada${archivedCount !== 1 ? 's' : ''} deletada${archivedCount !== 1 ? 's' : ''} com sucesso!`);
          setShowCleanupModal(false);
          fetchBookings();
        }}
      />
    </div>
  );
}
