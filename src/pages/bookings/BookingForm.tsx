import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, addDays, setHours, setMinutes, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar, Clock, Euro, AlertCircle, CheckCircle, User, Mail, Phone, MapPin, XCircle, Info } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { ServiceVariant, ServiceProfessional } from '../../types/service';
import { formatCurrency } from '../../utils/currency';
import { parseDurationToMinutes } from '../../utils/date';
import { TimeSlotSelector } from '../../components/TimeSlotSelector';
import { BookingConfirmationModal } from '../../components/BookingConfirmationModal';
import { InfoCard } from '../../components/InfoCard';

interface Service {
  id: string;
  title: string;
  price: number;
  duration: string;
  professional_id: string;
  professional: {
    full_name: string;
    avatar_url: string | null;
  };
  variants?: ServiceVariant[];
  service_professionals?: ServiceProfessional[];
}

interface BookingFormData {
  date: string;
  time: string;
  selectedProfessionalId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  notes: string;
}

interface TimeSlot {
  time: string;
  isAvailable: boolean;
  totalCapacity?: number;
  availableCapacity?: number;
  utilizationPercentage?: number;
  blockReason?: string;
  isBlockedSlot?: boolean;
  availableProfessionals: {
    unique_id: string;
    profile_id: string | null;
    team_member_id: string | null;
    full_name: string;
    avatar_url: string | null;
    is_primary: boolean;
  }[];
}

export function BookingForm() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get('service');
  const variantId = searchParams.get('variant');
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [service, setService] = useState<Service | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ServiceVariant | null>(null);
  const [formData, setFormData] = useState<BookingFormData>({
    date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    time: '09:00',
    selectedProfessionalId: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    notes: '',
  });
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [isDayBlocked, setIsDayBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showProfessionalModal, setShowProfessionalModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);
  const [totalServiceCapacity, setTotalServiceCapacity] = useState(1);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingErrorMessage, setBookingErrorMessage] = useState('');
  const [confirmedBookingDetails, setConfirmedBookingDetails] = useState<any>(null);

  useEffect(() => {
    if (!serviceId) {
      navigate('/services');
      return;
    }

    const loadService = async () => {
      try {
        const { data, error } = await supabase
          .from('services')
          .select(`
            *,
            professional:profiles!services_professional_id_fkey(
              full_name,
              avatar_url
            ),
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
          .eq('id', serviceId)
          .single();

        if (error) throw error;

        const { data: variantsData } = await supabase
          .from('service_variants')
          .select('*')
          .eq('service_id', serviceId)
          .order('display_order', { ascending: true });

        console.log('=== SERVICE DATA LOADED ===');
        console.log('Service professionals:', data.service_professionals);
        console.log('Team (JSONB):', data.team);
        console.log('Service owner ID:', data.professional_id);

        // Process team data from JSONB field
        let processedTeam = [];
        if (data.team && Array.isArray(data.team) && data.team.length > 0) {
          processedTeam = data.team.map((member: any) => {
            const isPrimary = member.is_primary === true;
            const teamMemberId = member.team_member_db_id || null;

            // CRITICAL: unique_id must match the format used in availability checks
            // For primary: unique_id = profile_id (service owner)
            // For collaborators: unique_id = team_member_db_id
            const uniqueId = isPrimary
              ? (member.profile_id || data.professional_id)
              : teamMemberId;

            // Ensure unique_id is always set
            if (!uniqueId) {
              console.error('Failed to generate unique_id for team member:', member);
            }

            return {
              ...member,
              unique_id: uniqueId,
              profile_id: isPrimary ? (member.profile_id || data.professional_id) : null,
              team_member_id: teamMemberId,
              is_primary: isPrimary
            };
          });
          console.log('Processed team members:', processedTeam);
        }

        setService({ ...data, team: processedTeam, variants: variantsData || [] });

        const calculatedCapacity = processedTeam.length > 0 ? processedTeam.length : 1;
        setTotalServiceCapacity(calculatedCapacity);
        console.log('=== TOTAL SERVICE CAPACITY SET ===', calculatedCapacity);

        if (variantId && variantsData) {
          const variant = variantsData.find((v: ServiceVariant) => v.id === variantId);
          if (variant) {
            setSelectedVariant(variant);
          }
        }
      } catch (err) {
        console.error('Error loading service:', err);
        setError('Erro ao carregar detalhes do serviço');
      } finally {
        setInitialLoading(false);
      }
    };

    loadService();
  }, [serviceId, navigate]);

  useEffect(() => {
    if (!service) {
      console.log('Skipping time slot load - missing service');
      return;
    }

    console.log('=== LOADING TIME SLOTS (REALTIME DATABASE) ===');
    console.log('Date:', formData.date);
    console.log('Service ID:', service.id);

    const loadTimeSlots = async (isRetry = false) => {
      setLoadingSlots(true);
      setError('');

      if (!isRetry) {
        setRetryCount(0);
      }

      try {
        const dateStr = formData.date;

        // CRITICAL: Usar a função RPC do Supabase que calcula disponibilidade em tempo real
        console.log('[REALTIME] Fetching availability matrix for:', service.id, dateStr);

        const { data: dailyMatrix, error: matrixError } = await supabase.rpc(
          'get_service_team_availability_matrix',
          {
            p_service_id: service.id,
            p_date: dateStr
          }
        );

        if (matrixError) {
          console.error('[REALTIME] Error fetching availability matrix:', matrixError);
          throw matrixError;
        }

        console.log('[REALTIME] Daily matrix loaded:', dailyMatrix);

        // Converter matriz para formato TimeSlot
        const slots: TimeSlot[] = [];

        if (dailyMatrix && Array.isArray(dailyMatrix)) {
          for (const matrixSlot of dailyMatrix) {
            const timeOnly = matrixSlot.time_slot?.substring(0, 5) || matrixSlot.slot_time?.substring(0, 5);

            if (!timeOnly) {
              console.warn('[REALTIME] Slot sem horário:', matrixSlot);
              continue;
            }

            // Buscar detalhes completos do slot (com lista de profissionais)
            const [hours, minutes] = timeOnly.split(':').map(Number);
            const startTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

            let endHours = hours;
            let endMinutes = minutes + 30;
            if (endMinutes >= 60) {
              endHours += 1;
              endMinutes -= 60;
            }
            const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`;

            const { data: slotDetails, error: detailsError } = await supabase.rpc(
              'get_available_professionals_for_slot',
              {
                p_service_id: service.id,
                p_date: dateStr,
                p_start_time: startTime,
                p_end_time: endTime
              }
            );

            if (detailsError) {
              console.error('[REALTIME] Error fetching slot details:', detailsError);
            }

            let availableCount = matrixSlot.available_count ?? matrixSlot.available ?? 0;
            const totalCount = matrixSlot.total_capacity ?? matrixSlot.total ?? 0;
            let professionals = slotDetails || [];
            const blockReason = matrixSlot.block_reason || null;

            // NOVO: Filtrar por profissional específico se selecionado
            if (formData.selectedProfessionalId) {
              professionals = professionals.filter((p: any) => p.profile_id === formData.selectedProfessionalId);
              availableCount = professionals.length;
            }

            console.log(`[SLOT ${timeOnly}] Matrix: ${availableCount}/${totalCount}, Professionals: ${professionals.length}, IsAvailable: ${availableCount > 0}, BlockReason: ${blockReason}`);

            // Determinar mensagem de bloqueio
            let slotBlockReason: string | undefined;
            let isBlockedSlot = false;

            if (availableCount === 0) {
              if (blockReason) {
                // Horário bloqueado (ex: Almoço, Pausa, Reunião)
                slotBlockReason = blockReason;
                isBlockedSlot = true;
              } else {
                // Horário esgotado por reservas
                slotBlockReason = 'Horário já esgotado - 0 vagas disponíveis';
                isBlockedSlot = false;
              }
            }

            slots.push({
              time: timeOnly,
              isAvailable: availableCount > 0,
              totalCapacity: totalCount,
              availableCapacity: availableCount,
              utilizationPercentage: totalCount > 0 ? Math.round(((totalCount - availableCount) / totalCount) * 100) : 0,
              availableProfessionals: professionals,
              blockReason: slotBlockReason,
              isBlockedSlot: isBlockedSlot
            });
          }
        }

        console.log('[REALTIME] Slots generated:', slots.length);
        console.log('[REALTIME] Available slots:', slots.filter(s => s.isAvailable).length);
        console.log('[REALTIME] Fully booked slots:', slots.filter(s => !s.isAvailable).length);

        // Verificar se o dia inteiro está bloqueado
        const allSlotsBlocked = slots.every(s => !s.isAvailable);
        if (allSlotsBlocked && slots.length > 0) {
          setIsDayBlocked(true);
          setBlockedReason('Dia completamente esgotado - Todos os horários já têm reservas confirmadas');
        } else {
          setIsDayBlocked(false);
          setBlockedReason('');
        }

        setTimeSlots(slots);
      } catch (err: any) {
        console.error('[AVAILABILITY] Error loading time slots:', err);
        console.error('[AVAILABILITY] Error details:', {
          message: err?.message,
          code: err?.code,
          retry: retryCount
        });

        // CRITICAL: Never block UI with generic error
        // Instead, implement exponential backoff retry
        if (retryCount < 3) {
          const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
          console.log(`[AVAILABILITY] Retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);

          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            loadTimeSlots(true);
          }, delay);
        } else {
          // After 3 retries, show error message
          console.error('[REALTIME] Max retries reached');
          setError('Erro ao carregar disponibilidade. Por favor, tente novamente ou contacte o suporte.');
          setTimeSlots([]);
        }
      } finally {
        setLoadingSlots(false);
      }
    };

    loadTimeSlots();

    const bookingsChannel = supabase
      .channel(`bookings_${service.id}_${formData.date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `service_id=eq.${service.id}`
        },
        (payload) => {
          console.log('Booking change detected:', payload);
          loadTimeSlots();
        }
      )
      .subscribe();

    return () => {
      bookingsChannel.unsubscribe();
    };
  }, [service, formData.date, selectedVariant]);

  const handleTimeSlotClick = (slot: TimeSlot) => {
    // CRITICAL FIX: Only block if there are NO professionals available (0/3)
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
        setSuccess(`${slot.availableProfessionals.find(p => p.unique_id === formData.selectedProfessionalId)?.full_name} está disponível às ${slot.time}!`);
        setTimeout(() => setSuccess(''), 3000);
        return;
      } else {
        // Pre-selected professional is NOT available for this time slot
        // BUT there are other professionals available (1/3, 2/3, etc)
        // SOLUTION: Show the modal to let user choose from available professionals
        const preSelectedName = service.service_professionals?.find(sp => sp.profile_id === formData.selectedProfessionalId)?.profile?.full_name ||
                                service.team?.find((m: any) => m.unique_id === formData.selectedProfessionalId)?.name ||
                                'O profissional selecionado';

        setError(`${preSelectedName} não está disponível às ${slot.time}. Por favor, escolha um dos ${slot.availableProfessionals.length} profissionais disponíveis.`);
        setTimeout(() => setError(''), 5000);

        // CRITICAL FIX: Instead of blocking, show available professionals
        if (slot.availableProfessionals.length === 1) {
          // Auto-select the only available professional
          setFormData(prev => ({
            ...prev,
            time: slot.time,
            selectedProfessionalId: slot.availableProfessionals[0].unique_id
          }));
          setSuccess(`${slot.availableProfessionals[0].full_name} foi selecionado automaticamente para ${slot.time}`);
          setTimeout(() => setSuccess(''), 3000);
          setTimeout(() => setError(''), 100);
          return;
        } else {
          // Show modal to choose from multiple available professionals
          setFormData(prev => ({ ...prev, time: slot.time }));
          setShowProfessionalModal(true);
          return;
        }
      }
    }

    // If only one professional is available, auto-select them
    if (slot.availableProfessionals.length === 1) {
      setFormData(prev => ({
        ...prev,
        time: slot.time,
        selectedProfessionalId: slot.availableProfessionals[0].unique_id
      }));
      setError('');
      setSuccess('Profissional e horário selecionados com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      // Show modal to choose from multiple professionals
      setFormData(prev => ({ ...prev, time: slot.time }));
      setShowProfessionalModal(true);
    }
  };

  const handleProfessionalSelect = (professionalId: string) => {
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
    if (!service) return;

    setError('');
    setSuccess('');
    setLoading(true);

    // LAYER 1: Basic field validation
    if (!formData.time) {
      setError('Por favor, selecione um horário disponível antes de continuar.');
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!formData.selectedProfessionalId) {
      setError('Por favor, selecione um profissional antes de continuar.');
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // LAYER 2: Check if day is blocked
    if (isDayBlocked) {
      setError(`Este dia está bloqueado: ${blockedReason}. Por favor, selecione outra data.`);
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // LAYER 3: Verify slot availability from local state
    const selectedSlot = timeSlots.find(slot => slot.time === formData.time);
    if (selectedSlot && !selectedSlot.isAvailable) {
      setError('O horário selecionado já não está disponível. Por favor, escolha outro horário.');
      setLoading(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Verify the selected professional is available for this slot
    // Only validate if we have availableProfessionals data and the slot has professionals
    if (selectedSlot && selectedSlot.availableProfessionals && selectedSlot.availableProfessionals.length > 0) {
      const isProfessionalAvailable = selectedSlot.availableProfessionals.some(p => {
        console.log('Checking availability:', {
          slotProfessional: p.unique_id,
          selectedProfessional: formData.selectedProfessionalId,
          match: p.unique_id === formData.selectedProfessionalId
        });
        return p.unique_id === formData.selectedProfessionalId;
      });

      if (!isProfessionalAvailable) {
        console.error('Professional not available:', {
          selectedProfessional: formData.selectedProfessionalId,
          availableProfessionals: selectedSlot.availableProfessionals.map(p => p.unique_id),
          slot: selectedSlot
        });
        setError('O profissional selecionado não está disponível para este horário. Por favor, escolha outro profissional ou outro horário.');
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    try {
      const startTime = new Date(`${formData.date}T${formData.time}`);
      const durationInMinutes = selectedVariant
        ? parseDurationToMinutes(selectedVariant.duration)
        : parseDurationToMinutes(service.duration);
      const endTime = new Date(startTime.getTime() + durationInMinutes * 60000);

      // LAYER 4: DOUBLE-CHECK in database before creating booking
      // This prevents race conditions where another client books the same slot
      // between selection and submission
      console.log('[VALIDATION] Layer 4: Double-checking availability in database...');
      const { data: conflictCheck, error: conflictError } = await supabase
        .from('bookings')
        .select('id')
        .eq('service_id', service.id)
        .eq('status', 'confirmado')
        .gte('start_time', startTime.toISOString())
        .lt('start_time', endTime.toISOString())
        .or(
          formData.selectedProfessionalId.includes('-')
            ? `team_member_id.eq.${formData.selectedProfessionalId}`
            : `professional_id.eq.${formData.selectedProfessionalId},team_member_id.is.null`
        );

      if (conflictError) {
        console.error('Error checking conflicts:', conflictError);
      }

      if (conflictCheck && conflictCheck.length > 0) {
        setError('Este horário acabou de ser reservado por outro cliente. Por favor, escolha outro horário.');
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Reload time slots to show updated availability
        const loadTimeSlots = async () => {
          setLoadingSlots(true);
          setTimeout(() => setLoadingSlots(false), 500);
        };
        loadTimeSlots();
        return;
      }

      let clientId = profile?.id;

      if (!profile) {
        if (!formData.guestName || !formData.guestEmail || !formData.guestPhone) {
          setError('Por favor, preencha todos os campos obrigatórios.');
          setLoading(false);
          return;
        }

        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', formData.guestEmail)
          .eq('is_guest', true)
          .maybeSingle();

        if (existingProfile) {
          clientId = existingProfile.id;
        } else {
          const guestId = crypto.randomUUID();

          const { error: profileError } = await supabase
            .from('profiles')
            .insert([{
              id: guestId,
              full_name: formData.guestName,
              email: formData.guestEmail,
              mobile_number: formData.guestPhone,
              role: 'client',
              is_guest: true
            }]);

          if (profileError) {
            console.error('Profile creation error:', profileError);
            throw new Error('Erro ao criar perfil de convidado. Por favor, tente novamente.');
          }
          clientId = guestId;
        }
      }

      // Find the selected professional/team member from the slot data
      const selectedSlotData = timeSlots.find(slot => slot.time === formData.time);
      const selectedProfessionalData = selectedSlotData?.availableProfessionals.find(
        p => p.unique_id === formData.selectedProfessionalId
      );

      console.log('=== CREATING BOOKING ===');
      console.log('Selected professional data:', selectedProfessionalData);
      console.log('Is primary:', selectedProfessionalData?.is_primary);
      console.log('Profile ID:', selectedProfessionalData?.profile_id);
      console.log('Team Member ID:', selectedProfessionalData?.team_member_id);
      console.log('Selected professional ID from form:', formData.selectedProfessionalId);

      // CRITICAL FIX: Determine professional_id and team_member_id for the booking
      let bookingProfessionalId: string;
      let bookingTeamMemberId: string | null = null;

      if (selectedProfessionalData?.is_primary) {
        // Primary professional (service owner): use their profile_id, team_member_id must be null
        bookingProfessionalId = selectedProfessionalData.profile_id || service.professional_id;
        bookingTeamMemberId = null; // EXPLICITLY SET TO NULL for service owner
        console.log('→ Booking with PRIMARY professional (service owner)');
      } else if (selectedProfessionalData?.team_member_id) {
        // Team member (collaborator): use service owner's profile_id and team_member_id
        bookingProfessionalId = service.professional_id;
        bookingTeamMemberId = selectedProfessionalData.team_member_id;
        console.log('→ Booking with COLLABORATOR (team member)');
      } else {
        // Fallback: use the service owner
        console.warn('⚠️ No professional data found, using service owner as fallback');
        bookingProfessionalId = service.professional_id;
        bookingTeamMemberId = null;
      }

      console.log('Booking will be created with:');
      console.log('- professional_id:', bookingProfessionalId, '(service owner)');
      console.log('- team_member_id:', bookingTeamMemberId, bookingTeamMemberId ? '(collaborator)' : '(null for primary)');

      const bookingData: any = {
        service_id: service.id,
        professional_id: bookingProfessionalId,
        team_member_id: bookingTeamMemberId,
        client_id: clientId,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        status: 'pendente',
        service_variant_id: selectedVariant?.id || null
      };

      if (formData.notes) {
        bookingData.notes = formData.notes;
      }

      const { error: bookingError } = await supabase
        .from('bookings')
        .insert([bookingData]);

      if (bookingError) throw bookingError;

      setConfirmedBookingDetails({
        serviceName: service.title,
        professionalName: selectedProfessionalData?.full_name || service.professional.full_name,
        date: formData.date,
        time: formData.time,
        duration: selectedVariant ? selectedVariant.duration : service.duration,
        price: selectedVariant ? formatCurrency(selectedVariant.price) : `${service.price}€`,
        variantName: selectedVariant?.name
      });

      setBookingSuccess(true);
      setShowConfirmationModal(true);
      setError('');
      setSuccess('');
    } catch (err: any) {
      console.error('Error creating booking:', err);

      let errorMessage = 'Erro ao criar reserva. Por favor, tente novamente.';

      if (err.message) {
        errorMessage = err.message;
      } else if (err.code === 'PGRST301') {
        errorMessage = 'Erro de permissão. Por favor, verifique os dados e tente novamente.';
      } else if (err.code === '23505') {
        errorMessage = 'Já existe uma reserva com estes dados. Por favor, verifique.';
      }

      setError(errorMessage);
      setBookingSuccess(false);
      setBookingErrorMessage(errorMessage);
      setShowConfirmationModal(true);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Service not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 sm:mb-8 text-center">
        <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2 sm:mb-3 px-2">Reservar Serviço</h1>
        <p className="text-sm sm:text-base text-gray-600 px-4">
          {profile ? 'As reservas da sua conta.' : 'Explore a disponibilidade em tempo real e reserve o melhor horário para si.'}
        </p>
        {!profile && (
          <InfoCard
            variant="subtle"
            dismissible={true}
            storageKey="public-calendar-info-seen"
            className="mt-3 sm:mt-4 p-3 sm:p-4"
          >
            <div className="flex items-start space-x-2 sm:space-x-3 pr-8">
              <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-xs sm:text-sm font-semibold text-gray-800 mb-1">
                  Calendário Público
                </p>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Explore a disponibilidade em tempo real sem precisar de conta.{' '}
                  <Link to="/auth/login" className="font-medium text-blue-600 hover:text-blue-700 underline">
                    Faça login
                  </Link>{' '}
                  para gerir as suas reservas.
                </p>
              </div>
            </div>
          </InfoCard>
        )}
      </div>

      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 mb-4 sm:mb-6 hover:shadow-xl transition-shadow duration-300">
        <div className="flex flex-col sm:flex-row items-start justify-between mb-4 gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{service.title}</h2>
          {selectedVariant ? (
            <div className="text-right sm:text-right">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{formatCurrency(selectedVariant.price)}</div>
              <div className="text-sm text-gray-500 flex items-center justify-end mt-1">
                <Clock className="h-4 w-4 mr-1" />
                {selectedVariant.duration}
              </div>
            </div>
          ) : (
            <div className="text-right sm:text-right">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600">{service.price}€</div>
              <div className="text-sm text-gray-500 flex items-center justify-end mt-1">
                <Clock className="h-4 w-4 mr-1" />
                {service.duration}
              </div>
            </div>
          )}
        </div>
        {selectedVariant && (
          <div className="mb-4 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl">
            <p className="text-xs font-medium text-blue-700 mb-1 uppercase tracking-wide">Opção Selecionada</p>
            <p className="text-lg sm:text-xl font-bold text-blue-900">{selectedVariant.name}</p>
          </div>
        )}

        {service.service_professionals && service.service_professionals.length > 1 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
              <User className="h-4 w-4 mr-2 text-blue-600" />
              Selecione o Profissional (Opcional)
            </label>
            <select
              value={formData.selectedProfessionalId}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  selectedProfessionalId: e.target.value
                }));
                setError('');
              }}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm mb-3"
            >
              <option value="">Todos os profissionais ({service.service_professionals.length})</option>
              {service.service_professionals
                .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
                .map((sp) => (
                  <option key={sp.id} value={sp.profile_id}>
                    {sp.profile?.full_name}{sp.is_primary ? ' ⭐ Principal' : ''}
                  </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 mb-4">
              {formData.selectedProfessionalId
                ? 'Mostrando apenas horários deste profissional'
                : 'Mostrando horários de todos os profissionais disponíveis'}
            </p>

            <div className="p-5 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-xl shadow-sm">
              <label className="block text-base font-semibold text-gray-800 mb-2 flex items-center">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Equipa do Serviço
              </label>
              <p className="text-sm text-gray-600 mb-4">
                Este serviço tem <strong>{service.service_professionals.length} profissionais</strong> na equipa.
              </p>
            <InfoCard variant="minimal" className="mb-4 pl-3 py-2">
              <InfoCard.Content>
                <span className="text-gray-700">
                  <strong className="text-gray-800">Como funciona:</strong> Selecione um profissional, depois escolha o horário disponível.
                  <InfoCard.Tooltip content="Se o profissional estiver disponível para o horário escolhido, a seleção é confirmada automaticamente. Caso contrário, poderá escolher outro profissional disponível.">
                    <Info className="inline h-3 w-3 ml-1 text-blue-500" />
                  </InfoCard.Tooltip>
                </span>
              </InfoCard.Content>
            </InfoCard>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {service.service_professionals.map((sp) => {
                const isSelected = formData.selectedProfessionalId === sp.profile_id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        selectedProfessionalId: sp.profile_id
                      }));
                      setError('');
                    }}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                    }`}
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
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 bg-green-600 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center animate-in zoom-in duration-200">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-center mt-2">
                      <div className={`font-medium text-xs ${
                        isSelected ? 'text-green-900' : 'text-gray-900'
                      }`}>{sp.profile?.full_name}</div>
                      {sp.is_primary && (
                        <span className="inline-flex items-center text-[10px] text-blue-600 font-semibold mt-0.5">
                          Principal
                        </span>
                      )}
                      {isSelected && (
                        <span className="inline-flex items-center text-[10px] text-green-600 font-bold mt-1">
                          ✓ Selecionado
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
            </div>
          </div>
        )}

        {(!service.service_professionals || service.service_professionals.length <= 1) && service.team && service.team.length > 1 && (
          <div className="mb-4 p-5 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-xl shadow-sm">
            <label className="block text-base font-semibold text-gray-800 mb-2 flex items-center">
              <User className="h-5 w-5 mr-2 text-blue-600" />
              Profissionais Disponíveis
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Este serviço tem <strong>{service.team.length} profissionais</strong> na equipa. Clique num profissional para o selecionar, depois escolha o horário disponível.
            </p>
            <InfoCard variant="minimal" className="mb-4 pl-3 py-2">
              <InfoCard.Content>
                <span className="text-gray-700">
                  <strong className="text-gray-800">Como funciona:</strong> Selecione um profissional, depois escolha o horário disponível.
                  <InfoCard.Tooltip content="Se o profissional estiver disponível para o horário escolhido, a seleção é confirmada automaticamente. Caso contrário, poderá escolher outro profissional disponível.">
                    <Info className="inline h-3 w-3 ml-1 text-blue-500" />
                  </InfoCard.Tooltip>
                </span>
              </InfoCard.Content>
            </InfoCard>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {service.team.map((member: any) => {
                const isSelected = formData.selectedProfessionalId === member.unique_id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        selectedProfessionalId: member.unique_id
                      }));
                      setError('');
                    }}
                    className={`flex flex-col items-center p-3 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-green-500 bg-green-50 shadow-md'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <div className="relative">
                      <img
                        src={member.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`}
                        alt={member.name}
                        className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
                      />
                      {member.is_primary && (
                        <div className="absolute -bottom-1 -right-1 bg-blue-600 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center">
                          <CheckCircle className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 bg-green-600 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center animate-in zoom-in duration-200">
                          <CheckCircle className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="text-center mt-2">
                      <div className={`font-medium text-xs ${
                        isSelected ? 'text-green-900' : 'text-gray-900'
                      }`}>{member.name}</div>
                      {member.is_primary && (
                        <span className="inline-flex items-center text-[10px] text-blue-600 font-semibold mt-0.5">
                          Principal
                        </span>
                      )}
                      {isSelected && (
                        <span className="inline-flex items-center text-[10px] text-green-600 font-bold mt-1">
                          ✓ Selecionado
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(!service.service_professionals || service.service_professionals.length <= 1) && (!service.team || service.team.length <= 1) && (
          <div className="flex items-center p-3 sm:p-4 bg-gray-50 rounded-xl">
            <img
              src={service.professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(service.professional.full_name)}&background=random`}
              alt={service.professional.full_name}
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-full object-cover mr-3 sm:mr-4"
            />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Profissional</div>
              <div className="text-base sm:text-lg font-semibold text-gray-900 truncate">{service.professional.full_name}</div>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6 bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 md:p-8 hover:shadow-xl transition-shadow duration-300">
        {error && (
          <div className="rounded-md bg-red-50 p-3 sm:p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}
        {success && (
          <div className="rounded-md bg-green-50 p-3 sm:p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        {!profile && (
          <div className="space-y-3 sm:space-y-4 pb-4 sm:pb-6 border-b border-gray-200">
            <div className="flex items-center space-x-2 mb-3 sm:mb-4">
              <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Informações de Contacto</h3>
            </div>

            <div>
              <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-1">
                Nome Completo *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  id="guestName"
                  required
                  value={formData.guestName}
                  onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                  className="block w-full pl-10 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="O seu nome"
                />
              </div>
            </div>

            <div>
              <label htmlFor="guestEmail" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="guestEmail"
                  required
                  value={formData.guestEmail}
                  onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                  className="block w-full pl-10 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="seu.email@exemplo.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="guestPhone" className="block text-sm font-medium text-gray-700 mb-1">
                Telemóvel *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="tel"
                  id="guestPhone"
                  required
                  value={formData.guestPhone}
                  onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                  className="block w-full pl-10 rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                  placeholder="+351912345678"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="date" className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Calendar className="h-4 w-4 mr-2 text-blue-600" />
            Selecionar Data
          </label>
          <input
            type="date"
            id="date"
            required
            min={format(addDays(new Date(), 1), 'yyyy-MM-dd')}
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm shadow-sm"
          />
        </div>

        {isDayBlocked ? (
          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl border-2 border-red-300 p-6 shadow-inner">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-500 flex items-center justify-center shadow-lg">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-900">Dia Bloqueado</h3>
                <p className="text-sm text-red-700">Este dia está indisponível para agendamentos</p>
              </div>
            </div>
            <div className="bg-white bg-opacity-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-800">
                <span className="font-bold">Motivo:</span> {blockedReason || 'Dia indisponível'}
              </p>
            </div>
            <p className="text-xs text-red-600">
              Por favor, selecione outra data para continuar com a sua reserva.
            </p>
          </div>
        ) : loadingSlots ? (
          <div className="flex flex-col items-center justify-center py-12 bg-blue-50 rounded-xl border-2 border-blue-300">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-sm text-blue-700 font-medium">A carregar horários disponíveis...</p>
            <p className="text-xs text-blue-600 mt-1">Verificando agenda do profissional selecionado</p>
            {retryCount > 0 && (
              <p className="text-xs text-blue-500 mt-2">Tentativa {retryCount + 1} de 3...</p>
            )}
          </div>
        ) : (
          <>
            <InfoCard
              variant="subtle"
              dismissible={true}
              storageKey="booking-capacity-info-seen"
              collapsible={true}
              defaultCollapsed={false}
              className="p-3 sm:p-4"
            >
              <div className="pr-16">
                <InfoCard.Header icon={CheckCircle} color="emerald">
                  Sistema de Disponibilidade
                </InfoCard.Header>
                <InfoCard.Content>
                  <p className="mb-2">
                    Este serviço tem <strong>{totalServiceCapacity} {totalServiceCapacity === 1 ? 'profissional' : 'profissionais'}</strong>. Os horários bloqueiam apenas quando todos estão ocupados com reservas confirmadas.
                  </p>
                  <div className="flex items-center space-x-3 mt-2">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                      <span className="text-xs text-gray-600">Disponível</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                      <span className="text-xs text-gray-600">Parcial</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
                      <span className="text-xs text-gray-600">Esgotado</span>
                    </div>
                  </div>
                </InfoCard.Content>
              </div>
            </InfoCard>
            <TimeSlotSelector
              timeSlots={timeSlots}
              selectedTime={formData.time}
              onTimeSelect={(time) => setFormData({ ...formData, time })}
              onSlotClick={handleTimeSlotClick}
              showCapacityInfo={true}
              showProfessionalCount={true}
              totalServiceCapacity={totalServiceCapacity}
            />
          </>
        )}

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
            placeholder="Alguma informação adicional ou pedido especial..."
          />
        </div>

        <div className="bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 rounded-xl p-4 sm:p-6 mt-4 sm:mt-6 border border-blue-100 shadow-inner">
          <div className="flex items-center mb-3 sm:mb-4">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-blue-600 flex items-center justify-center mr-2 sm:mr-3">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-blue-900">Resumo da Reserva</h3>
          </div>
          <div className="mt-2 space-y-2 text-sm text-blue-700">
            {selectedVariant && (
              <p><strong>Opção:</strong> {selectedVariant.name}</p>
            )}
{formData.selectedProfessionalId ? (() => {
              const selectedProf = service.service_professionals?.find(sp => sp.profile_id === formData.selectedProfessionalId);
              const selectedTeamMember = service.team?.find((m: any) => m.unique_id === formData.selectedProfessionalId);
              const profName = selectedProf?.profile?.full_name || selectedTeamMember?.name || service.professional.full_name;
              return (
                <div className="flex items-center py-3 px-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border-2 border-green-300 shadow-sm">
                  <User className="h-5 w-5 mr-2 text-green-700" />
                  <div className="flex-1">
                    <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Profissional Selecionado</p>
                    <p className="text-base font-bold text-green-900">{profName}</p>
                  </div>
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
              );
            })() : (
              <div className="flex items-center py-3 px-4 bg-red-50 rounded-lg border-2 border-red-300">
                <AlertCircle className="h-5 w-5 mr-2 text-red-600" />
                <p className="text-sm text-red-700 font-medium">⚠️ Nenhum profissional selecionado</p>
              </div>
            )}
            <p><strong>Data:</strong> {format(new Date(formData.date), 'PPP', { locale: pt })}</p>
            <p><strong>Hora:</strong> {formData.time}</p>
            <p><strong>Duração:</strong> {selectedVariant ? selectedVariant.duration : service.duration}</p>
            <p><strong>Preço:</strong> {selectedVariant ? formatCurrency(selectedVariant.price) : `${service.price}€`}</p>
            {!profile && formData.guestName && (
              <p><strong>{t('bookings.info.client')}:</strong> {formData.guestName}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
          <button
            type="button"
            onClick={() => navigate(`/services/${service.id}`)}
            className="px-6 py-2.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-gradient disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5"
          >
            {loading ? 'A criar reserva...' : 'Confirmar Reserva'}
          </button>
        </div>
      </form>

      {showProfessionalModal && selectedTimeSlot && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-lg w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-5 sm:px-6 sm:py-5 flex justify-between items-center rounded-t-3xl sm:rounded-t-2xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Escolha o Profissional</h2>
                <p className="text-sm text-gray-600 mt-1">Horário: {selectedTimeSlot.time}</p>
              </div>
              <button
                onClick={() => {
                  setShowProfessionalModal(false);
                  setSelectedTimeSlot(null);
                }}
                className="text-gray-400 hover:text-gray-500 p-3 hover:bg-gray-100 rounded-full transition-colors min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation active:scale-95"
              >
                <XCircle className="h-7 w-7" />
              </button>
            </div>

            <div className="p-5 sm:p-6 md:p-8">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">
                      {selectedTimeSlot.availableProfessionals.length} {selectedTimeSlot.availableProfessionals.length === 1 ? 'profissional disponível' : 'profissionais disponíveis'}
                    </p>
                    <p>Escolha o profissional que prefere para este horário.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {selectedTimeSlot.availableProfessionals.map((professional) => (
                  <button
                    key={professional.unique_id}
                    type="button"
                    onClick={() => handleProfessionalSelect(professional.unique_id)}
                    className="w-full flex items-center p-5 sm:p-6 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 group min-h-[80px] touch-manipulation active:scale-98"
                  >
                    <div className="relative">
                      <img
                        src={professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(professional.full_name)}&background=random`}
                        alt={professional.full_name}
                        className="h-16 w-16 sm:h-18 sm:w-18 rounded-full object-cover border-2 border-white shadow-md group-hover:border-blue-500 transition-all"
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

      <BookingConfirmationModal
        isOpen={showConfirmationModal}
        isSuccess={bookingSuccess}
        errorMessage={bookingErrorMessage}
        bookingDetails={confirmedBookingDetails}
        onClose={() => setShowConfirmationModal(false)}
        isGuest={!profile}
      />
    </div>
  );
}