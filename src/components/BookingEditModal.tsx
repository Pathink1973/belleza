import { useState, useEffect } from 'react';
import { Calendar, Clock, X, AlertCircle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ptLocale } from '../i18n';
import { checkSlotAvailability } from '../utils/availability';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: 'pendente' | 'confirmado' | 'concluído' | 'cancelado';
  professional_id: string;
  team_member_id?: string | null;
  service: {
    id: string;
    title: string;
    price: number;
    category: string;
  };
  service_variant?: {
    id: string;
    name: string;
    price: number;
    duration: string;
  } | null;
  professional: {
    full_name: string;
  };
  team_member?: {
    name: string;
  } | null;
}

interface BookingEditModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

export function BookingEditModal({ booking, onClose, onSuccess }: BookingEditModalProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  useEffect(() => {
    const startDate = new Date(booking.start_time);
    setSelectedDate(format(startDate, 'yyyy-MM-dd'));
    setSelectedTime(format(startDate, 'HH:mm'));
  }, [booking]);

  useEffect(() => {
    if (selectedDate) {
      fetchAvailableSlots();
    }
  }, [selectedDate]);

  const fetchAvailableSlots = async () => {
    setCheckingAvailability(true);
    try {
      const { data: availability } = await supabase
        .from('availability')
        .select('*')
        .eq('professional_id', booking.professional_id)
        .eq('day_of_week', new Date(selectedDate).getDay());

      if (!availability || availability.length === 0) {
        setAvailableSlots([]);
        return;
      }

      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('professional_id', booking.professional_id)
        .gte('start_time', `${selectedDate}T00:00:00`)
        .lt('start_time', `${selectedDate}T23:59:59`)
        .neq('id', booking.id)
        .in('status', ['pendente', 'confirmado']);

      const slots: string[] = [];
      availability.forEach((avail) => {
        const startHour = parseInt(avail.start_time.split(':')[0]);
        const startMinute = parseInt(avail.start_time.split(':')[1]);
        const endHour = parseInt(avail.end_time.split(':')[0]);
        const endMinute = parseInt(avail.end_time.split(':')[1]);

        for (let hour = startHour; hour < endHour; hour++) {
          for (let minute = hour === startHour ? startMinute : 0; minute < 60; minute += 30) {
            if (hour === endHour - 1 && minute >= endMinute) break;

            const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const slotDateTime = new Date(`${selectedDate}T${timeSlot}`);

            const serviceDuration = booking.service_variant?.duration || '60 minutos';
            const durationMatch = serviceDuration.match(/(\d+)/);
            const durationMinutes = durationMatch ? parseInt(durationMatch[1]) : 60;
            const slotEndTime = new Date(slotDateTime.getTime() + durationMinutes * 60000);

            const isBooked = existingBookings?.some((b) => {
              const bookingStart = new Date(b.start_time);
              const bookingEnd = new Date(b.end_time);
              return (
                (slotDateTime >= bookingStart && slotDateTime < bookingEnd) ||
                (slotEndTime > bookingStart && slotEndTime <= bookingEnd) ||
                (slotDateTime <= bookingStart && slotEndTime >= bookingEnd)
              );
            });

            if (!isBooked) {
              slots.push(timeSlot);
            }
          }
        }
      });

      setAvailableSlots(slots);
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError('Erro ao verificar disponibilidade');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) {
      setError('Por favor, selecione data e hora');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const startDateTime = new Date(`${selectedDate}T${selectedTime}`);
      const serviceDuration = booking.service_variant?.duration || '60 minutos';
      const durationMatch = serviceDuration.match(/(\d+)/);
      const durationMinutes = durationMatch ? parseInt(durationMatch[1]) : 60;
      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);

      const endTimeStr = `${endDateTime.getHours().toString().padStart(2, '0')}:${endDateTime.getMinutes().toString().padStart(2, '0')}`;

      if (booking.status === 'confirmado') {
        const slotAvailability = await checkSlotAvailability(
          booking.service.id,
          selectedDate,
          selectedTime,
          endTimeStr
        );

        if (!slotAvailability.isAvailable && slotAvailability.availableCount === 0) {
          setError('O horário selecionado não tem capacidade disponível. Por favor, escolha outro horário.');
          setLoading(false);
          return;
        }
      }

      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString()
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert({
        user_id: booking.professional_id,
        type: 'booking_updated',
        title: 'Reserva Alterada',
        message: `${booking.service.title} foi reagendado para ${format(startDateTime, 'PPP', { locale: ptLocale })} às ${format(startDateTime, 'p', { locale: ptLocale })}`,
        related_id: booking.id
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating booking:', err);
      setError(err.message || 'Erro ao atualizar reserva');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Editar Reserva</h2>
            <p className="text-blue-100 text-sm mt-1">{booking.service.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-2">Reserva Atual</h3>
            <div className="flex items-center text-gray-700 mb-1">
              <Calendar className="h-4 w-4 mr-2 text-blue-600" />
              <span>{format(new Date(booking.start_time), 'PPP', { locale: ptLocale })}</span>
            </div>
            <div className="flex items-center text-gray-700 mb-1">
              <Clock className="h-4 w-4 mr-2 text-blue-600" />
              <span>{format(new Date(booking.start_time), 'p', { locale: ptLocale })} - {format(new Date(booking.end_time), 'p', { locale: ptLocale })}</span>
            </div>
            <div className="flex items-center text-gray-700">
              <User className="h-4 w-4 mr-2 text-blue-600" />
              <span>
                {booking.team_member?.name || booking.professional?.full_name || 'Profissional'}
                {booking.team_member_id && <span className="text-blue-600 text-xs ml-1">(colaborador)</span>}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nova Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {checkingAvailability ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : availableSlots.length > 0 ? (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Novo Horário
              </label>
              <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedTime === slot
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
          ) : selectedDate ? (
            <div className="text-center py-8 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertCircle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
              <p className="text-gray-700">Não há horários disponíveis para esta data</p>
            </div>
          ) : null}

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !selectedTime || checkingAvailability}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-cyan-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
