import { useState } from 'react';
import { X, AlertTriangle, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ptLocale } from '../i18n';

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
  professional: {
    full_name: string;
  };
  team_member?: {
    name: string;
  } | null;
}

interface BookingCancelModalProps {
  booking: Booking;
  onClose: () => void;
  onSuccess: () => void;
}

export function BookingCancelModal({ booking, onClose, onSuccess }: BookingCancelModalProps) {
  const [cancellationReason, setCancellationReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    if (!cancellationReason.trim()) {
      setError('Por favor, indique o motivo do cancelamento');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'cancelado',
          cancellation_reason: cancellationReason
        })
        .eq('id', booking.id);

      if (updateError) throw updateError;

      await supabase.from('notifications').insert({
        user_id: booking.professional_id,
        type: 'booking_cancelled',
        title: 'Reserva Cancelada',
        message: `${booking.service.title} agendado para ${format(new Date(booking.start_time), 'PPP', { locale: ptLocale })} foi cancelado. Motivo: ${cancellationReason}`,
        related_id: booking.id
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error cancelling booking:', err);
      setError(err.message || 'Erro ao cancelar reserva');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <div className="flex items-center">
            <AlertTriangle className="h-6 w-6 mr-3" />
            <h2 className="text-2xl font-bold">Cancelar Reserva</h2>
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
            <div className="rounded-lg bg-red-50 p-4 border border-red-200">
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">{booking.service.title}</h3>
            <div className="flex items-center text-gray-600 text-sm mb-1">
              <User className="h-4 w-4 mr-2" />
              <span>
                {booking.team_member?.name || booking.professional?.full_name || 'Profissional'}
                {booking.team_member_id && <span className="text-blue-600 text-xs ml-1">(colaborador)</span>}
              </span>
            </div>
            <p className="text-gray-600 text-sm">
              Data: {format(new Date(booking.start_time), 'PPP', { locale: ptLocale })} às {format(new Date(booking.start_time), 'p', { locale: ptLocale })}
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Atenção:</strong> Esta ação irá cancelar a sua reserva. O profissional será notificado sobre o cancelamento.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Motivo do Cancelamento *
            </label>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              rows={4}
              placeholder="Por favor, indique o motivo do cancelamento..."
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 px-4 py-3 text-gray-900 placeholder-gray-400 resize-none"
              required
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50"
            >
              Voltar
            </button>
            <button
              onClick={handleCancel}
              disabled={loading || !cancellationReason.trim()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:from-red-700 hover:to-orange-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'A cancelar...' : 'Confirmar Cancelamento'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
