import { useState, useEffect } from 'react';
import { X, Clock, Calendar, User, AlertCircle, CheckCircle, Coffee, UtensilsCrossed, Users, Ban } from 'lucide-react';
import { format, addHours, addMinutes, parse, setHours, setMinutes } from 'date-fns';
import { pt } from 'date-fns/locale';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { parseDurationToMinutes } from '../utils/date';

interface QuickBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedDate?: string;
  preSelectedServiceId?: string;
}

interface ServiceVariant {
  id: string;
  service_id: string;
  variant_name: string;
  duration: string;
  price: number;
  display_order: number;
}

interface Service {
  id: string;
  title: string;
  duration: string;
  variants?: ServiceVariant[];
}

interface BlockTemplate {
  id: string;
  name: string;
  default_duration: string;
  icon: string;
  color: string;
}

const iconMap: { [key: string]: any } = {
  Coffee,
  UtensilsCrossed,
  Users,
  Ban,
};

export function QuickBlockModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedDate,
  preSelectedServiceId
}: QuickBlockModalProps) {
  const { profile } = useAuthStore();
  const [services, setServices] = useState<Service[]>([]);
  const [templates, setTemplates] = useState<BlockTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    serviceId: preSelectedServiceId || '',
    variantId: '',
    date: preSelectedDate || format(new Date(), 'yyyy-MM-dd'),
    startTime: format(setMinutes(setHours(new Date(), new Date().getHours() + 1), 0), 'HH:mm'),
    endTime: format(setMinutes(setHours(new Date(), new Date().getHours() + 2), 0), 'HH:mm'),
    reason: '',
    applyToAllVariants: false,
  });

  useEffect(() => {
    if (isOpen && profile?.id) {
      loadServices();
      loadTemplates();
    }
  }, [isOpen, profile?.id]);

  const loadServices = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, title, duration')
        .eq('professional_id', profile.id)
        .order('title');

      if (error) throw error;

      // Load variants for each service
      const servicesWithVariants = await Promise.all(
        (data || []).map(async (service) => {
          const { data: variants, error: variantsError } = await supabase
            .from('service_variants')
            .select('*')
            .eq('service_id', service.id)
            .order('display_order');

          if (variantsError) {
            console.error('Error loading variants:', variantsError);
            return { ...service, variants: [] };
          }

          return { ...service, variants: variants || [] };
        })
      );

      setServices(servicesWithVariants);

      if (servicesWithVariants.length > 0 && !formData.serviceId) {
        setFormData(prev => ({ ...prev, serviceId: servicesWithVariants[0].id }));
      }
    } catch (err) {
      console.error('Error loading services:', err);
    }
  };

  const loadTemplates = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('block_templates')
        .select('*')
        .eq('professional_id', profile.id)
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const applyTemplate = (template: BlockTemplate) => {
    const durationMinutes = parseDurationToMinutes(template.default_duration);
    const startDate = parse(formData.startTime, 'HH:mm', new Date());
    const endDate = addMinutes(startDate, durationMinutes);

    setFormData(prev => ({
      ...prev,
      endTime: format(endDate, 'HH:mm'),
      reason: template.name,
    }));
  };

  const validateTimes = () => {
    const start = parse(formData.startTime, 'HH:mm', new Date());
    const end = parse(formData.endTime, 'HH:mm', new Date());

    if (end <= start) {
      setError('A hora de fim deve ser posterior à hora de início.');
      return false;
    }

    const diffMinutes = (end.getTime() - start.getTime()) / 60000;
    if (diffMinutes > 480) {
      setError('O bloqueio não pode ter mais de 8 horas de duração.');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    setError('');
    setSuccess('');

    if (!validateTimes()) return;

    if (!formData.serviceId) {
      setError('Por favor, selecione um serviço.');
      return;
    }

    const selectedService = services.find(s => s.id === formData.serviceId);
    if (!selectedService) {
      setError('Serviço não encontrado.');
      return;
    }

    if (!formData.applyToAllVariants && !formData.variantId) {
      setError('Por favor, selecione uma variante ou aplique a todas as variantes.');
      return;
    }

    setLoading(true);

    try {
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

      const variantsToBlock = formData.applyToAllVariants
        ? (selectedService.variants || []).map(v => v.id)
        : [formData.variantId];

      if (variantsToBlock.length === 0) {
        setError('Este serviço não tem variantes configuradas.');
        setLoading(false);
        return;
      }

      const blockInserts = variantsToBlock.map(variantId => ({
        service_id: formData.serviceId,
        service_variant_id: variantId,
        professional_id: profile.id,
        booking_type: 'bloqueio',
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: 'confirmado',
        block_reason: formData.reason || 'Indisponível',
        client_id: null,
      }));

      const { error: insertError } = await supabase
        .from('bookings')
        .insert(blockInserts);

      if (insertError) throw insertError;

      setSuccess(`Bloqueio criado com sucesso para ${variantsToBlock.length} variante(s)!`);

      setTimeout(() => {
        onSuccess();
        onClose();
        resetForm();
      }, 1500);
    } catch (err: any) {
      console.error('Error creating block:', err);
      setError(err.message || 'Erro ao criar bloqueio. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      serviceId: preSelectedServiceId || services[0]?.id || '',
      variantId: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: format(setMinutes(setHours(new Date(), new Date().getHours() + 1), 0), 'HH:mm'),
      endTime: format(setMinutes(setHours(new Date(), new Date().getHours() + 2), 0), 'HH:mm'),
      reason: '',
      applyToAllVariants: false,
    });
    setError('');
    setSuccess('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center">
            <div className="bg-amber-100 p-2 rounded-lg mr-3">
              <Ban className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Criar Bloqueio Rápido</h2>
              <p className="text-sm text-gray-600">Marque horários indisponíveis rapidamente</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {success && (
            <div className="rounded-lg bg-green-50 p-4 flex items-start">
              <CheckCircle className="h-5 w-5 text-green-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-700">{success}</div>
            </div>
          )}

          {templates.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Templates Rápidos
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {templates.map(template => {
                  const IconComponent = iconMap[template.icon] || Coffee;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="flex flex-col items-center p-3 rounded-lg border-2 border-gray-200 hover:border-amber-400 hover:bg-amber-50 transition-all"
                    >
                      <IconComponent className="h-5 w-5 text-gray-600 mb-1" />
                      <span className="text-xs font-medium text-gray-700">{template.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Serviço *
            </label>
            <select
              required
              value={formData.serviceId}
              onChange={(e) => setFormData({ ...formData, serviceId: e.target.value, variantId: '', applyToAllVariants: false })}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="">Selecione um serviço</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.title}
                </option>
              ))}
            </select>
          </div>

          {formData.serviceId && (() => {
            const selectedService = services.find(s => s.id === formData.serviceId);
            return selectedService && selectedService.variants && selectedService.variants.length > 0 ? (
              <>
                <div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.applyToAllVariants}
                      onChange={(e) => setFormData({ ...formData, applyToAllVariants: e.target.checked, variantId: '' })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Aplicar a todas as variantes ({selectedService.variants.length})
                    </span>
                  </label>
                </div>

                {!formData.applyToAllVariants && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Variante *
                    </label>
                    <select
                      required
                      value={formData.variantId}
                      onChange={(e) => setFormData({ ...formData, variantId: e.target.value })}
                      className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    >
                      <option value="">Selecione uma variante</option>
                      {selectedService.variants.map(variant => (
                        <option key={variant.id} value={variant.id}>
                          {variant.variant_name} - {variant.duration}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            ) : formData.serviceId ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-800">
                  Este serviço não tem variantes configuradas. Por favor, adicione variantes antes de criar bloqueios.
                </p>
              </div>
            ) : null;
          })()}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data *
            </label>
            <input
              type="date"
              required
              min={format(new Date(), 'yyyy-MM-dd')}
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora Início *
              </label>
              <input
                type="time"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hora Fim *
              </label>
              <input
                type="time"
                required
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motivo (opcional)
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Ex: Almoço, Reunião, Pausa..."
              maxLength={100}
              className="block w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando...' : 'Criar Bloqueio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
