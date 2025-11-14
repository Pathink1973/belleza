import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { Clock, Save, Trash2, Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface AvailabilitySlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

const DAYS_OF_WEEK = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' }
];

export function Availability() {
  const { profile } = useAuthStore();
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (profile?.id) {
      fetchAvailability();
    }
  }, [profile?.id]);

  const fetchAvailability = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('availability')
        .select('*')
        .eq('professional_id', profile.id)
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setAvailabilitySlots(data);
      } else {
        setAvailabilitySlots([{
          day_of_week: 1,
          start_time: '09:00',
          end_time: '20:00',
          is_available: true
        }]);
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError('Erro ao carregar disponibilidade');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = () => {
    setAvailabilitySlots([
      ...availabilitySlots,
      {
        day_of_week: 1,
        start_time: '09:00',
        end_time: '20:00',
        is_available: true
      }
    ]);
  };

  const handleRemoveSlot = async (index: number) => {
    const slot = availabilitySlots[index];

    if (slot.id) {
      try {
        const { error } = await supabase
          .from('availability')
          .delete()
          .eq('id', slot.id);

        if (error) throw error;
        setSuccess('Horário removido com sucesso');
      } catch (err) {
        console.error('Error deleting slot:', err);
        setError('Erro ao remover horário');
        return;
      }
    }

    const newSlots = availabilitySlots.filter((_, i) => i !== index);
    setAvailabilitySlots(newSlots);
  };

  const handleSlotChange = (index: number, field: keyof AvailabilitySlot, value: any) => {
    const newSlots = [...availabilitySlots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    setAvailabilitySlots(newSlots);
  };

  const handleSave = async () => {
    if (!profile?.id) {
      setError('Erro: ID do profissional não encontrado. Por favor, recarregue a página.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Validate all slots before attempting to save
      for (const slot of availabilitySlots) {
        if (!slot.start_time || !slot.end_time) {
          throw new Error('Todos os campos de horário são obrigatórios');
        }
        if (slot.start_time >= slot.end_time) {
          throw new Error('Hora de início deve ser anterior à hora de fim');
        }
        if (slot.day_of_week === null || slot.day_of_week === undefined) {
          throw new Error('Dia da semana é obrigatório');
        }
      }

      // Separate new slots from existing slots
      const newSlots = availabilitySlots.filter(slot => !slot.id);
      const existingSlots = availabilitySlots.filter(slot => slot.id);

      console.log('New slots to insert:', newSlots.length);
      console.log('Existing slots to update:', existingSlots.length);

      // Insert new slots (without id field to let database generate it)
      if (newSlots.length > 0) {
        const slotsToInsert = newSlots.map(slot => ({
          professional_id: profile.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_available: slot.is_available ?? true
        }));

        console.log('Inserting new availability slots:', slotsToInsert);

        const { error: insertError } = await supabase
          .from('availability')
          .insert(slotsToInsert);

        if (insertError) {
          console.error('Error inserting new slots:', insertError);
          throw insertError;
        }
      }

      // Update existing slots (with id field)
      if (existingSlots.length > 0) {
        const slotsToUpdate = existingSlots.map(slot => ({
          id: slot.id,
          professional_id: profile.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
          is_available: slot.is_available ?? true
        }));

        console.log('Updating existing availability slots:', slotsToUpdate);

        const { error: updateError } = await supabase
          .from('availability')
          .upsert(slotsToUpdate, {
            onConflict: 'id'
          });

        if (updateError) {
          console.error('Error updating existing slots:', updateError);
          throw updateError;
        }
      }

      setSuccess('Disponibilidade guardada com sucesso');
      fetchAvailability();
    } catch (err: any) {
      console.error('Error saving availability:', err);
      let errorMessage = 'Erro ao guardar disponibilidade';

      if (err.message) {
        errorMessage = err.message;
      } else if (err.hint) {
        errorMessage = err.hint;
      } else if (err.details) {
        errorMessage = err.details;
      }

      // Provide more specific error messages for common issues
      if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
        errorMessage = 'Já existe um horário com essas configurações. Por favor, verifique os horários existentes.';
      } else if (errorMessage.includes('foreign key') || errorMessage.includes('professional_id')) {
        errorMessage = 'Erro ao validar o ID do profissional. Por favor, recarregue a página e tente novamente.';
      } else if (errorMessage.includes('not-null constraint')) {
        errorMessage = 'Todos os campos obrigatórios devem ser preenchidos.';
      }

      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Disponibilidade</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-2">Defina os seus horários de trabalho por dia da semana</p>
        </div>
        <button
          onClick={handleAddSlot}
          className="btn-gradient inline-flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Adicionar Horário
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

      <div className="card-gradient p-6 space-y-4">
        {availabilitySlots.map((slot, index) => (
          <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dia da Semana
                </label>
                <select
                  value={slot.day_of_week}
                  onChange={(e) => handleSlotChange(index, 'day_of_week', parseInt(e.target.value))}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  {DAYS_OF_WEEK.map(day => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora de Início
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="time"
                    value={slot.start_time}
                    onChange={(e) => handleSlotChange(index, 'start_time', e.target.value)}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hora de Fim
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="time"
                    value={slot.end_time}
                    onChange={(e) => handleSlotChange(index, 'end_time', e.target.value)}
                    className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <label className="flex items-center space-x-2 bg-white px-4 py-2.5 rounded-md border border-gray-300">
                  <input
                    type="checkbox"
                    checked={slot.is_available}
                    onChange={(e) => handleSlotChange(index, 'is_available', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Disponível</span>
                </label>
              </div>
            </div>

            <button
              onClick={() => handleRemoveSlot(index)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remover horário"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}

        {availabilitySlots.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum horário definido. Clique em "Adicionar Horário" para começar.
          </div>
        )}

        <div className="flex justify-end pt-4">
          <button
            onClick={handleSave}
            disabled={saving || availabilitySlots.length === 0 || !profile?.id}
            className="btn-gradient inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5 mr-2" />
            {saving ? 'A guardar...' : 'Guardar Disponibilidade'}
          </button>
        </div>
      </div>

      <div className="card-gradient p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-2">Como funciona:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Defina os horários em que está disponível para cada dia da semana</li>
              <li>Pode adicionar múltiplos períodos para o mesmo dia (ex: manhã e tarde)</li>
              <li>Os clientes só poderão agendar dentro dos horários definidos</li>
              <li>Desmarque "Disponível" para criar uma pausa sem remover o horário</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
