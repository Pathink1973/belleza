import { useState, useEffect } from 'react';
import { Ban, Trash2, Plus, AlertCircle, Calendar, Clock, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { QuickBlockModal } from '../../components/QuickBlockModal';

interface Block {
  id: string;
  start_time: string;
  end_time: string;
  block_reason: string;
  service_id: string;
  service: {
    title: string;
  };
}

export function BlockManagement() {
  const { profile } = useAuthStore();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showQuickBlockModal, setShowQuickBlockModal] = useState(false);
  const [filterDate, setFilterDate] = useState<'future' | 'past' | 'all'>('future');

  useEffect(() => {
    if (profile?.id) {
      loadBlocks();
    }
  }, [profile?.id, filterDate]);

  const loadBlocks = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      setError('');

      let query = supabase
        .from('bookings')
        .select(`
          id,
          start_time,
          end_time,
          block_reason,
          service_id,
          service:services(title)
        `)
        .eq('professional_id', profile.id)
        .eq('booking_type', 'bloqueio')
        .eq('status', 'confirmado')
        .order('start_time', { ascending: true });

      const now = new Date().toISOString();

      if (filterDate === 'future') {
        query = query.gte('start_time', now);
      } else if (filterDate === 'past') {
        query = query.lt('start_time', now);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setBlocks(data || []);
    } catch (err: any) {
      console.error('Error loading blocks:', err);
      setError('Erro ao carregar bloqueios.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm('Tem certeza que deseja remover este bloqueio?')) return;

    try {
      setError('');
      setSuccess('');

      const { error: deleteError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', blockId);

      if (deleteError) throw deleteError;

      setSuccess('Bloqueio removido com sucesso!');
      setTimeout(() => setSuccess(''), 3000);

      await loadBlocks();
    } catch (err: any) {
      console.error('Error deleting block:', err);
      setError('Erro ao remover bloqueio.');
    }
  };

  const groupBlocksByDate = () => {
    const grouped: { [date: string]: Block[] } = {};

    blocks.forEach(block => {
      const date = format(parseISO(block.start_time), 'yyyy-MM-dd');
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(block);
    });

    return grouped;
  };

  const groupedBlocks = groupBlocksByDate();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestão de Bloqueios</h1>
            <p className="text-gray-600">Visualize e gerencie seus bloqueios de horário</p>
          </div>
          <button
            onClick={() => setShowQuickBlockModal(true)}
            className="flex items-center px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-sm transition-all font-medium"
          >
            <Plus className="h-5 w-5 mr-2" />
            Novo Bloqueio
          </button>
        </div>

        <div className="flex items-center space-x-2 mb-6">
          <button
            onClick={() => setFilterDate('future')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterDate === 'future'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Próximos
          </button>
          <button
            onClick={() => setFilterDate('past')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterDate === 'past'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Anteriores
          </button>
          <button
            onClick={() => setFilterDate('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterDate === 'all'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          <button
            onClick={loadBlocks}
            className="ml-auto p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Atualizar"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-lg bg-green-50 p-4 flex items-center">
          <AlertCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0" />
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 text-gray-400 animate-spin" />
        </div>
      ) : blocks.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Ban className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Nenhum bloqueio encontrado
          </h3>
          <p className="text-gray-500 mb-6">
            {filterDate === 'future'
              ? 'Não há bloqueios agendados para o futuro.'
              : filterDate === 'past'
              ? 'Não há bloqueios anteriores registados.'
              : 'Não há bloqueios registados.'}
          </p>
          <button
            onClick={() => setShowQuickBlockModal(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg shadow-sm transition-all font-medium"
          >
            <Plus className="h-5 w-5 mr-2" />
            Criar Primeiro Bloqueio
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedBlocks).map(([date, dateBlocks]) => (
            <div key={date} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    {format(parseISO(date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: pt })}
                  </h3>
                  <span className="ml-auto bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
                    {dateBlocks.length} {dateBlocks.length === 1 ? 'bloqueio' : 'bloqueios'}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-gray-200">
                {dateBlocks.map(block => (
                  <div
                    key={block.id}
                    className="px-6 py-4 hover:bg-amber-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="bg-amber-100 p-3 rounded-lg">
                          <Ban className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="text-base font-semibold text-gray-900 mb-1">
                            {block.block_reason || 'Indisponível'}
                          </h4>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {format(parseISO(block.start_time), 'HH:mm')} - {format(parseISO(block.end_time), 'HH:mm')}
                            </div>
                            <div className="text-gray-500">
                              {block.service.title}
                            </div>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteBlock(block.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        title="Remover bloqueio"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <QuickBlockModal
        isOpen={showQuickBlockModal}
        onClose={() => setShowQuickBlockModal(false)}
        onSuccess={() => {
          setShowQuickBlockModal(false);
          loadBlocks();
        }}
      />
    </div>
  );
}
