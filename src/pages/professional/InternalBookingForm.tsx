import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, addDays, setHours, setMinutes, isAfter, isBefore, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar, Clock, AlertCircle, CheckCircle, User, Phone, Plus, Search, X } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/currency';
import { parseDurationToMinutes } from '../../utils/date';

interface Client {
  id: string;
  full_name: string;
  mobile_number: string;
}

interface ServiceProfessional {
  id: string;
  profile_id: string;
  is_primary: boolean;
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface Service {
  id: string;
  title: string;
  price: number;
  duration: string;
  service_professionals?: ServiceProfessional[];
}

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

interface InternalBookingFormData {
  clientId: string;
  serviceId: string;
  selectedProfessionalId: string;
  date: string;
  time: string;
  notes: string;
  newClientName: string;
  newClientPhone: string;
}

export function InternalBookingForm() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewClientForm, setShowNewClientForm] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [showProfessionalModal, setShowProfessionalModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [formData, setFormData] = useState<InternalBookingFormData>({
    clientId: '',
    serviceId: '',
    selectedProfessionalId: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '09:00',
    notes: '',
    newClientName: '',
    newClientPhone: '',
  });

  useEffect(() => {
    if (profile?.id) {
      fetchClients();
      fetchServices();
    }
  }, [profile?.id]);

  useEffect(() => {
    if (formData.serviceId && formData.date) {
      loadTimeSlots();
    }
  }, [formData.serviceId, formData.date]);

  const fetchClients = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, mobile_number')
        .eq('role', 'client')
        .order('full_name');

      if (error) throw error;
      setClients(data || []);
    } catch (err) {
      console.error('Error fetching clients:', err);
    }
  };

  const fetchServices = async () => {
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          id,
          title,
          price,
          duration,
          service_professionals(
            id,
            profile_id,
            is_primary,
            profile:profiles!service_professionals_profile_id_fkey(
              full_name,
              avatar_url
            )
          )
        `)
        .eq('professional_id', profile.id)
        .order('title');

      if (error) throw error;
      setServices(data || []);
    } catch (err) {
      console.error('Error fetching services:', err);
    }
  };

  const loadTimeSlots = async () => {
    if (!formData.serviceId) return;

    try {
      const selectedService = services.find(s => s.id === formData.serviceId);
      if (!selectedService) return;

      console.log('=== LOADING TIME SLOTS (Internal Booking Form) ===');
      console.log('Service:', selectedService.id);
      console.log('Date:', formData.date);

      // Get all professionals for this service with unique_id
      const allProfessionals = selectedService.service_professionals?.map(sp => ({
        unique_id: sp.profile_id,
        profile_id: sp.profile_id,
        team_member_id: null,
        full_name: sp.profile?.full_name || '',
        avatar_url: sp.profile?.avatar_url || null,
        is_primary: sp.is_primary
      })) || [];

      console.log('All professionals with unique_id:', allProfessionals);

      if (allProfessionals.length === 0) {
        setTimeSlots([]);
        return;
      }

      const startOfDayTime = startOfDay(new Date(formData.date));
      const endOfDayTime = new Date(startOfDayTime);
      endOfDayTime.setDate(endOfDayTime.getDate() + 1);

      const professionalIds = allProfessionals.map(p => p.profile_id).filter(Boolean);
      const teamMemberIds = allProfessionals.map(p => p.team_member_id).filter(Boolean);

      console.log('Professional IDs to check:', professionalIds);
      console.log('Team Member IDs to check:', teamMemberIds);

      // Fetch bookings for this service on this date
      // IMPORTANT: Only count "confirmado" bookings as they block time slots
      // Professional can create bookings even if slots show as "pendente"
      const { data: existingBookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('start_time, end_time, professional_id, team_member_id')
        .eq('service_id', selectedService.id)
        .eq('status', 'confirmado')  // CRITICAL: Only confirmed bookings block slots
        .gte('start_time', startOfDayTime.toISOString())
        .lt('start_time', endOfDayTime.toISOString());

      if (bookingsError) throw bookingsError;

      const slots: TimeSlot[] = [];
      const durationInMinutes = parseDurationToMinutes(selectedService.duration);

      for (let hour = 9; hour <= 19; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slotTime = format(setMinutes(setHours(new Date(formData.date), hour), minute), 'HH:mm');
          const slotStart = new Date(`${formData.date}T${slotTime}`);
          const slotEnd = new Date(slotStart.getTime() + durationInMinutes * 60000);

          // Check which professionals are available for this slot
          // Only professionals WITHOUT confirmed bookings in this time slot are available
          const availableProfessionals = allProfessionals.filter(professional => {
            const hasConflict = existingBookings?.some(booking => {
              // Determine if this booking belongs to the current professional
              let isThisProfessional = false;

              // CRITICAL: Proper professional matching logic
              // For primary professionals (service owner): check professional_id and team_member_id must be null
              if (professional.is_primary && professional.profile_id) {
                isThisProfessional = (
                  booking.professional_id === professional.profile_id &&
                  booking.team_member_id === null
                );
              }
              // For team members (collaborators): check team_member_id
              else if (!professional.is_primary && professional.team_member_id) {
                isThisProfessional = (
                  booking.team_member_id === professional.team_member_id
                );
              }

              if (!isThisProfessional) return false;

              // Check time conflict (interval overlap)
              const bookingStart = new Date(booking.start_time);
              const bookingEnd = new Date(booking.end_time);
              return (
                (isAfter(slotStart, bookingStart) && isBefore(slotStart, bookingEnd)) ||
                (isAfter(slotEnd, bookingStart) && isBefore(slotEnd, bookingEnd)) ||
                (isBefore(slotStart, bookingStart) && isAfter(slotEnd, bookingEnd))
              );
            });
            // Professional is available if they have NO conflicting confirmed bookings
            return !hasConflict;
          });

          // Slot is available only if at least ONE professional is free
          // If all professionals have confirmed bookings, slot is blocked
          slots.push({
            time: slotTime,
            isAvailable: availableProfessionals.length > 0,  // Block if no professionals available
            availableProfessionals
          });
        }
      }

      console.log('Generated slots (first 5):', slots.slice(0, 5));
      setTimeSlots(slots);
    } catch (err) {
      console.error('Error loading time slots:', err);
    }
  };

  const handleCreateNewClient = async () => {
    if (!formData.newClientName || !formData.newClientPhone) {
      setError('Por favor, preencha o nome e telemóvel do cliente.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const clientId = crypto.randomUUID();

      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: clientId,
          full_name: formData.newClientName,
          mobile_number: formData.newClientPhone,
          role: 'client'
        }]);

      if (profileError) throw profileError;

      const noteContent = `Novo cliente: ${formData.newClientName}\nTelemóvel: ${formData.newClientPhone}`;
      await supabase
        .from('client_notes')
        .insert({
          client_id: clientId,
          professional_id: profile?.id,
          note: noteContent,
          created_at: new Date().toISOString()
        });

      setFormData({
        ...formData,
        clientId: clientId,
        newClientName: '',
        newClientPhone: '',
      });
      setShowNewClientForm(false);
      await fetchClients();
      setSuccess(t('clients.success.clientAdded'));
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error creating client:', err);
      setError('Erro ao criar cliente.');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    if (!slot.isAvailable || !slot.availableProfessionals || slot.availableProfessionals.length === 0) {
      return;
    }

    setSelectedTimeSlot(slot);

    // Check if a professional has already been pre-selected
    if (formData.selectedProfessionalId) {
      // Verify if the pre-selected professional is available for this time slot
      const isPreSelectedAvailable = slot.availableProfessionals.some(
        p => p.unique_id === formData.selectedProfessionalId
      );

      if (isPreSelectedAvailable) {
        // Pre-selected professional is available, keep the selection and set the time
        setFormData(prev => ({
          ...prev,
          time: slot.time
        }));
        setError('');
        setSuccess('Profissional e horário selecionados com sucesso!');
        setTimeout(() => setSuccess(''), 3000);
        return;
      } else {
        // Pre-selected professional is NOT available, but others are
        // Clear the pre-selection and allow user to choose from available professionals
        if (slot.availableProfessionals.length === 1) {
          // Only one professional available, auto-select them
          setFormData(prev => ({
            ...prev,
            time: slot.time,
            selectedProfessionalId: slot.availableProfessionals[0].unique_id
          }));
          setError('');
          setSuccess('Profissional e horário selecionados com sucesso!');
          setTimeout(() => setSuccess(''), 3000);
          return;
        } else {
          // Multiple professionals available, show selection modal
          setFormData(prev => ({ ...prev, time: slot.time, selectedProfessionalId: '' }));
          setShowProfessionalModal(true);
          setError('');
          return;
        }
      }
    }

    // If only one professional is available, auto-select them
    if (slot.availableProfessionals.length === 1) {
      setFormData(prev => ({
        ...prev,
        time: slot.time,
        selectedProfessionalId: slot.availableProfessionals![0].unique_id
      }));
      setError('');
      setSuccess('Profissional e horário selecionados com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setFormData(prev => ({ ...prev, time: slot.time }));
      setShowProfessionalModal(true);
    }
  };

  const handleProfessionalSelect = (professionalId: string) => {
    console.log('=== PROFESSIONAL SELECTED ===');
    console.log('Selected professional unique_id:', professionalId);

    setFormData(prev => ({
      ...prev,
      selectedProfessionalId: professionalId
    }));
    setShowProfessionalModal(false);
    setError('');
    setSuccess('Profissional e horário selecionados com sucesso!');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    if (!formData.clientId || !formData.serviceId) {
      setError('Por favor, selecione um cliente e um serviço.');
      return;
    }

    if (!formData.selectedProfessionalId) {
      setError('Por favor, selecione um horário e profissional para realizar o serviço.');
      return;
    }

    const selectedSvc = services.find(s => s.id === formData.serviceId);
    if (selectedSvc && (!selectedSvc.service_professionals || selectedSvc.service_professionals.length === 0)) {
      setError('Este serviço não tem profissionais associados. Por favor, configure a equipa do serviço primeiro.');
      return;
    }

    // Verify the selected professional is available for this slot
    const selectedSlot = timeSlots.find(slot => slot.time === formData.time);
    if (selectedSlot && selectedSlot.availableProfessionals && selectedSlot.availableProfessionals.length > 0) {
      const isProfessionalAvailable = selectedSlot.availableProfessionals.some(p => p.unique_id === formData.selectedProfessionalId);
      if (!isProfessionalAvailable) {
        console.error('Professional validation failed:');
        console.error('Selected ID:', formData.selectedProfessionalId);
        console.error('Available professionals:', selectedSlot.availableProfessionals);
        setError('O profissional selecionado não está disponível para este horário. Por favor, escolha outro profissional ou outro horário.');
        return;
      }
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const selectedService = services.find(s => s.id === formData.serviceId);
      if (!selectedService) throw new Error('Serviço não encontrado');

      const startTime = new Date(`${formData.date}T${formData.time}`);
      const durationInMinutes = parseDurationToMinutes(selectedService.duration);
      const endTime = new Date(startTime.getTime() + durationInMinutes * 60000);

      console.log('=== TIME CALCULATION DEBUG ===');
      console.log('Date:', formData.date);
      console.log('Time:', formData.time);
      console.log('Duration string:', selectedService.duration);
      console.log('Duration in minutes:', durationInMinutes);
      console.log('Start time:', startTime.toISOString());
      console.log('End time:', endTime.toISOString());
      console.log('Time difference (ms):', endTime.getTime() - startTime.getTime());
      console.log('Is end > start?', endTime > startTime);

      // Find the selected professional/team member from the slot data
      const selectedSlotData = timeSlots.find(slot => slot.time === formData.time);
      const selectedProfessionalData = selectedSlotData?.availableProfessionals?.find(
        p => p.unique_id === formData.selectedProfessionalId
      );

      console.log('=== CREATING BOOKING (Internal) ===');
      console.log('Selected professional data:', selectedProfessionalData);
      console.log('Is primary:', selectedProfessionalData?.is_primary);
      console.log('Profile ID:', selectedProfessionalData?.profile_id);
      console.log('Team Member ID:', selectedProfessionalData?.team_member_id);

      // Determine professional_id and team_member_id for the booking
      let bookingProfessionalId: string;
      let bookingTeamMemberId: string | null = null;

      if (selectedProfessionalData?.is_primary) {
        // Primary professional (service owner): use their profile_id, team_member_id is null
        bookingProfessionalId = selectedProfessionalData.profile_id || profile.id;
      } else if (selectedProfessionalData?.team_member_id) {
        // Team member (collaborator): use service owner's profile_id and team_member_id
        bookingProfessionalId = profile.id;
        bookingTeamMemberId = selectedProfessionalData.team_member_id;
      } else {
        // Fallback: use the service owner
        bookingProfessionalId = profile.id;
      }

      console.log('Booking will be created with:');
      console.log('- professional_id:', bookingProfessionalId);
      console.log('- team_member_id:', bookingTeamMemberId);

      const bookingData: any = {
        service_id: formData.serviceId,
        professional_id: bookingProfessionalId,
        team_member_id: bookingTeamMemberId,
        client_id: formData.clientId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'confirmado',
      };

      if (formData.notes) {
        bookingData.notes = formData.notes;
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert([bookingData]);

      if (bookingError) throw bookingError;

      setSuccess('Reserva interna criada com sucesso!');
      setTimeout(() => {
        navigate('/professional/calendar');
      }, 2000);
    } catch (err) {
      console.error('Error creating booking:', err);
      setError('Erro ao criar reserva. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.full_name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.mobile_number.includes(clientSearch)
  );

  const selectedService = services.find(s => s.id === formData.serviceId);

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Criar Reserva Interna</h1>
        <p className="text-gray-600">Criar uma reserva para um cliente existente ou novo</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-red-50 p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-400 mr-2 flex-shrink-0" />
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        <div className="card-gradient p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('bookings.info.client')} *
              </label>
              <button
                type="button"
                onClick={() => setShowNewClientForm(!showNewClientForm)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center"
              >
                {showNewClientForm ? (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    Cancelar
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('clients.addClient')}
                  </>
                )}
              </button>
            </div>

            {showNewClientForm ? (
              <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('clients.form.name')}
                  </label>
                  <input
                    type="text"
                    value={formData.newClientName}
                    onChange={(e) => setFormData({ ...formData, newClientName: e.target.value })}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telemóvel
                  </label>
                  <input
                    type="tel"
                    value={formData.newClientPhone}
                    onChange={(e) => setFormData({ ...formData, newClientPhone: e.target.value })}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="+351912345678"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateNewClient}
                  disabled={loading}
                  className="w-full btn-gradient py-2"
                >
                  {loading ? t('common.saving') : t('clients.addClient')}
                </button>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="block w-full pl-10 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    placeholder="Pesquisar cliente..."
                  />
                </div>
                <select
                  required
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Selecione um cliente</option>
                  {filteredClients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.full_name} - {client.mobile_number}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Serviço *
            </label>
            <select
              required
              value={formData.serviceId}
              onChange={(e) => {
                const newServiceId = e.target.value;
                setFormData({ ...formData, serviceId: newServiceId, selectedProfessionalId: '', time: '09:00' });
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Selecione um serviço</option>
              {services.map(service => (
                <option key={service.id} value={service.id}>
                  {service.title} - {formatCurrency(service.price)} - {service.duration}
                </option>
              ))}
            </select>
          </div>

          {formData.serviceId && selectedService && (
            <>
              {selectedService.service_professionals && selectedService.service_professionals.length > 0 ? (
                <div className="p-5 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-xl shadow-sm">
                  <label className="block text-base font-semibold text-gray-800 mb-2 flex items-center">
                    <User className="h-5 w-5 mr-2 text-blue-600" />
                    Profissionais Disponíveis ({selectedService.service_professionals.length})
                  </label>
                  <p className="text-sm text-gray-600 mb-4">
                    Os horários abaixo mostram a disponibilidade de todos os profissionais. Selecione um horário para escolher o profissional.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {selectedService.service_professionals.map((sp) => (
                      <div
                        key={sp.id}
                        className="flex flex-col items-center p-3 rounded-xl border-2 border-gray-200 bg-white"
                      >
                        <div className="relative">
                          <img
                            src={sp.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(sp.profile?.full_name || '')}&background=random`}
                            alt={sp.profile?.full_name}
                            className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                          />
                          {sp.is_primary && (
                            <div className="absolute -bottom-1 -right-1 bg-blue-600 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center">
                              <CheckCircle className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </div>
                        <div className="text-center mt-2">
                          <div className="font-medium text-gray-900 text-xs">{sp.profile?.full_name}</div>
                          {sp.is_primary && (
                            <span className="inline-flex items-center text-[10px] text-blue-600 font-semibold mt-0.5">
                              Principal
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-amber-50 p-4 border-2 border-amber-200">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">Este serviço não tem profissionais configurados</p>
                      <p>Por favor, vá para a página de <a href="/professional/team" className="underline font-semibold">Gestão de Colaboradores</a> para adicionar profissionais à equipa deste serviço antes de criar reservas.</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Data *
              </label>
              <input
                type="date"
                id="date"
                required
                min={format(new Date(), 'yyyy-MM-dd')}
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hora * {formData.selectedProfessionalId && '(Profissional selecionado)'}
              </label>
              {timeSlots.length > 0 ? (
                <div className="space-y-2">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                    <p className="text-xs text-green-700">
                      Mostrando horários disponíveis de todos os profissionais. Clique para selecionar.
                    </p>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-60 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                    {timeSlots.map((slot, index) => {
                      const isSelected = formData.time === slot.time;
                      return (
                        <button
                          key={index}
                          type="button"
                          disabled={!slot.isAvailable}
                          onClick={() => handleTimeSlotSelect(slot)}
                          className={`
                            relative py-2 px-2 rounded-lg text-sm font-medium transition-all duration-200
                            ${isSelected
                              ? 'bg-blue-600 text-white shadow-lg scale-105'
                              : slot.isAvailable
                                ? 'bg-white text-gray-700 hover:bg-blue-50 border border-gray-200 hover:scale-102'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                            }
                          `}
                        >
                          <div className="flex flex-col items-center">
                            <span className={isSelected ? 'font-bold' : ''}>{slot.time}</span>
                            {slot.availableProfessionals && slot.availableProfessionals.length > 0 && (
                              <span className="text-[10px] text-gray-500 mt-0.5">
                                {slot.availableProfessionals.length}p
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : formData.serviceId ? (
                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  Configure a equipa do serviço primeiro para ver os horários disponíveis.
                </div>
              ) : (
                <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                  Selecione um serviço primeiro
                </div>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notas (opcional)
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
              placeholder="Informações adicionais sobre a reserva..."
            />
          </div>

          {formData.clientId && formData.serviceId && selectedService && (
            <div className="bg-blue-50 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-3">Resumo da Reserva</h3>
              <div className="space-y-2 text-sm text-blue-700">
                <p><strong>{t('bookings.info.client')}:</strong> {clients.find(c => c.id === formData.clientId)?.full_name}</p>
                <p><strong>Serviço:</strong> {selectedService.title}</p>
                <p><strong>Data:</strong> {format(new Date(formData.date), 'PPP', { locale: pt })}</p>
                <p><strong>Hora:</strong> {formData.time}</p>
                <p><strong>Duração:</strong> {selectedService.duration}</p>
                <p><strong>Preço:</strong> {formatCurrency(selectedService.price)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/professional/calendar')}
            className="px-6 py-2.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-gradient disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5"
          >
            {loading ? 'A criar...' : 'Criar Reserva'}
          </button>
        </div>
      </form>

      {showProfessionalModal && selectedTimeSlot && selectedTimeSlot.availableProfessionals && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Escolha o Profissional</h2>
                <p className="text-sm text-gray-600 mt-1">Horário: {selectedTimeSlot.time}</p>
              </div>
              <button
                onClick={() => {
                  setShowProfessionalModal(false);
                  setSelectedTimeSlot(null);
                }}
                className="text-gray-400 hover:text-gray-500 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">
                      {selectedTimeSlot.availableProfessionals.length} {selectedTimeSlot.availableProfessionals.length === 1 ? 'profissional disponível' : 'profissionais disponíveis'}
                    </p>
                    <p>Escolha o profissional para realizar este serviço.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {selectedTimeSlot.availableProfessionals.map((professional) => (
                  <button
                    key={professional.unique_id}
                    type="button"
                    onClick={() => handleProfessionalSelect(professional.unique_id)}
                    className="w-full flex items-center p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group"
                  >
                    <div className="relative">
                      <img
                        src={professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(professional.full_name)}&background=random`}
                        alt={professional.full_name}
                        className="h-16 w-16 rounded-full object-cover border-2 border-white shadow-md group-hover:border-blue-500 transition-all"
                      />
                      {professional.is_primary && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 h-6 w-6 rounded-full border-2 border-white flex items-center justify-center">
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 text-left ml-4">
                      <div className="font-bold text-gray-900 text-lg group-hover:text-blue-700 transition-colors">
                        {professional.full_name}
                      </div>
                      {professional.is_primary && (
                        <span className="inline-flex items-center text-xs text-blue-600 font-semibold bg-blue-100 px-2 py-1 rounded-full mt-1">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Principal
                        </span>
                      )}
                    </div>
                    <div className="text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
