import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, addDays, setHours, setMinutes, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Calendar, Clock, Euro, AlertCircle, CheckCircle, User, Mail, Phone, MapPin, XCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { ServiceVariant, ServiceProfessional } from '../../types/service';
import { formatCurrency } from '../../utils/currency';
import { parseDurationToMinutes } from '../../utils/date';
import { TimeSlotSelector } from '../../components/TimeSlotSelector';

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
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showProfessionalModal, setShowProfessionalModal] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlot | null>(null);

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

    console.log('=== LOADING TIME SLOTS (AGGREGATED) ===');
    console.log('Date:', formData.date);

    const loadTimeSlots = async () => {
      setLoadingSlots(true);
      try {
        // Get all professionals for this service
        // PRIORITY: Use service.team if available (includes all team members)
        let allProfessionals: any[] = [];

        if (service.team && service.team.length > 0) {
          // Use the processed team data which includes both primary and collaborators
          allProfessionals = service.team.map(member => ({
            unique_id: member.unique_id,
            profile_id: member.profile_id || null,
            team_member_id: member.team_member_id || null,
            full_name: member.name,
            avatar_url: member.imageUrl,
            is_primary: member.is_primary || false
          }));
        } else if (service.service_professionals && service.service_professionals.length > 0) {
          allProfessionals = service.service_professionals.map(sp => ({
            unique_id: sp.profile_id,
            profile_id: sp.profile_id,
            team_member_id: null,
            full_name: sp.profile?.full_name || '',
            avatar_url: sp.profile?.avatar_url || null,
            is_primary: sp.is_primary
          }));
        } else {
          // Single professional service
          allProfessionals = [{
            unique_id: service.professional_id,
            profile_id: service.professional_id,
            team_member_id: null,
            full_name: service.professional.full_name,
            avatar_url: service.professional.avatar_url,
            is_primary: true
          }];
        }

        console.log('=== ALL PROFESSIONALS FOR AVAILABILITY CHECK ===');
        console.log('Total:', allProfessionals.length);
        allProfessionals.forEach(p => {
          console.log(`- ${p.full_name}: unique_id=${p.unique_id}, profile_id=${p.profile_id}, team_member_id=${p.team_member_id}, is_primary=${p.is_primary}`);
        });

        // Fetch bookings for ALL professionals
        const startOfDayTime = startOfDay(new Date(formData.date));
        const endOfDayTime = new Date(startOfDayTime);
        endOfDayTime.setDate(endOfDayTime.getDate() + 1);

        // Collect all IDs we need to check: profile_ids and team_member_ids
        const professionalIds = allProfessionals.map(p => p.profile_id).filter(Boolean);
        const teamMemberIds = allProfessionals.map(p => p.team_member_id).filter(Boolean);

        let existingBookings: any[] = [];

        // Fetch bookings for this service on this date
        // IMPORTANT: Only count "confirmado" bookings as they block time slots
        // "pendente" bookings do not block availability until confirmed by professional
        const { data: allServiceBookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('start_time, end_time, professional_id, team_member_id')
          .eq('service_id', service.id)
          .eq('status', 'confirmado')  // CRITICAL: Only confirmed bookings block slots
          .gte('start_time', startOfDayTime.toISOString())
          .lt('start_time', endOfDayTime.toISOString());

        if (bookingsError) throw bookingsError;
        existingBookings = allServiceBookings || [];

        // CRITICAL: Fetch blocked time slots for ALL professionals
        // Blocked time slots prevent ANY booking, regardless of professional availability
        const { data: blockedTimeSlots, error: blockedError } = await supabase
          .from('blocked_time_slots')
          .select('professional_id, start_time, end_time')
          .in('professional_id', professionalIds)
          .eq('date', formData.date);

        if (blockedError) {
          console.error('Error fetching blocked time slots:', blockedError);
        }

        console.log('Blocked time slots for date:', blockedTimeSlots || []);

        console.log('All professionals to check:', allProfessionals);
        console.log('Professional IDs:', professionalIds);
        console.log('Team Member IDs:', teamMemberIds);
        console.log('Existing bookings for service:', existingBookings);

        // Generate time slots with availability per professional
        const slots: TimeSlot[] = [];
        const durationInMinutes = selectedVariant
          ? parseDurationToMinutes(selectedVariant.duration)
          : parseDurationToMinutes(service.duration);

        for (let hour = 9; hour <= 19; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            const slotTime = format(setMinutes(setHours(new Date(formData.date), hour), minute), 'HH:mm');
            const slotStart = new Date(`${formData.date}T${slotTime}`);
            const slotEnd = new Date(slotStart.getTime() + durationInMinutes * 60000);

            // Check which professionals are available for this slot
            // Only professionals WITHOUT confirmed bookings OR blocked time slots are available
            const availableProfessionals = allProfessionals.filter(professional => {
              // Check for booking conflicts
              const hasConflict = existingBookings?.some(booking => {
                // Determine if this booking belongs to the current professional
                let isThisProfessional = false;

                // CRITICAL: Proper professional matching logic
                // For primary professionals (service owner): match by professional_id with NULL team_member_id
                if (professional.is_primary && professional.profile_id) {
                  isThisProfessional = (
                    booking.professional_id === professional.profile_id &&
                    booking.team_member_id === null
                  );
                }
                // For team members (collaborators): match by team_member_id
                else if (!professional.is_primary && professional.team_member_id) {
                  isThisProfessional = (
                    booking.team_member_id === professional.team_member_id
                  );
                }

                if (!isThisProfessional) return false;

                // Check time conflict (interval overlap)
                // Two intervals overlap if: start1 < end2 AND start2 < end1
                const bookingStart = new Date(booking.start_time);
                const bookingEnd = new Date(booking.end_time);
                const timeConflict = (
                  (isAfter(slotStart, bookingStart) && isBefore(slotStart, bookingEnd)) ||
                  (isAfter(slotEnd, bookingStart) && isBefore(slotEnd, bookingEnd)) ||
                  (isBefore(slotStart, bookingStart) && isAfter(slotEnd, bookingEnd))
                );

                return timeConflict;
              });

              // Check for blocked time slots
              const hasBlockedSlot = blockedTimeSlots?.some(blockedSlot => {
                // Check if this blocked slot belongs to current professional
                const isThisProfessional = (
                  (professional.is_primary && professional.profile_id === blockedSlot.professional_id) ||
                  (!professional.is_primary && professional.profile_id === blockedSlot.professional_id)
                );

                if (!isThisProfessional) return false;

                // Parse blocked time slot times (format: HH:MM:SS)
                const blockedStartTime = blockedSlot.start_time.substring(0, 5); // Get HH:MM
                const blockedEndTime = blockedSlot.end_time.substring(0, 5);

                // Check if slot overlaps with blocked time
                const slotTimeStr = format(slotStart, 'HH:mm');
                const slotEndTimeStr = format(slotEnd, 'HH:mm');

                const timeConflict = (
                  (slotTimeStr >= blockedStartTime && slotTimeStr < blockedEndTime) ||
                  (slotEndTimeStr > blockedStartTime && slotEndTimeStr <= blockedEndTime) ||
                  (slotTimeStr <= blockedStartTime && slotEndTimeStr >= blockedEndTime)
                );

                return timeConflict;
              });

              // Professional is available if they have NO conflicts (bookings or blocked slots)
              return !hasConflict && !hasBlockedSlot;
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

        console.log('=== SLOTS GENERATED ===');
        console.log('Total slots:', slots.length);
        const sampleSlot = slots.find(s => s.isAvailable);
        if (sampleSlot) {
          console.log('Sample available slot:', {
            time: sampleSlot.time,
            availableProfessionals: sampleSlot.availableProfessionals.map(p => ({
              name: p.full_name,
              unique_id: p.unique_id,
              is_primary: p.is_primary
            }))
          });
        }
        console.log('Available slots:', slots.filter(s => s.isAvailable).length);
        setTimeSlots(slots);
      } catch (err) {
        console.error('Error loading time slots:', err);
        setError('Error loading available time slots');
      } finally {
        setLoadingSlots(false);
      }
    };

    loadTimeSlots();
  }, [service, formData.date, selectedVariant]);

  const handleTimeSlotClick = (slot: TimeSlot) => {
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
        const preSelectedName = service.service_professionals?.find(sp => sp.profile_id === formData.selectedProfessionalId)?.profile?.full_name ||
                                service.team?.find((m: any) => m.unique_id === formData.selectedProfessionalId)?.name ||
                                'O profissional selecionado';

        setError(`${preSelectedName} não está disponível às ${slot.time}. Por favor, escolha outro horário ou outro profissional.`);
        setTimeout(() => setError(''), 5000);
        return;
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

      // DOUBLE-CHECK: Verify professional is still available before creating booking
      // This prevents race conditions where another client books the same slot
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

      setSuccess('Reserva criada com sucesso! Aguarde a confirmação do profissional.');
      setTimeout(() => {
        if (profile) {
          navigate('/reviews');
        } else {
          navigate('/services');
        }
      }, 3000);
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
        <p className="text-sm sm:text-base text-gray-600 px-4">As reservas da sua conta.</p>
        {!profile && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mt-3 sm:mt-4">
            <p className="text-xs sm:text-sm text-blue-800">
              Já tem conta?{' '}
              <Link to="/auth/login" className="font-semibold underline hover:text-blue-900">
                Faça login
              </Link>{' '}
              para gerir as suas reservas facilmente.
            </p>
          </div>
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
          <div className="mb-4 p-5 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-xl shadow-sm">
            <label className="block text-base font-semibold text-gray-800 mb-2 flex items-center">
              <User className="h-5 w-5 mr-2 text-blue-600" />
              Profissionais Disponíveis
            </label>
            <p className="text-sm text-gray-600 mb-4">
              Este serviço tem <strong>{service.service_professionals.length} profissionais</strong> na equipa. Clique num profissional para o selecionar, depois escolha o horário disponível.
            </p>
            <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-700 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                <strong>Como funciona:</strong> Clique num profissional para o selecionar (aparece badge verde). Depois escolha um horário disponível. Se o profissional estiver disponível para esse horário, a seleção é confirmada automaticamente.
              </p>
            </div>
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
            <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 mb-4 flex items-start">
              <AlertCircle className="h-5 w-5 text-blue-700 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                <strong>Como funciona:</strong> Clique num profissional para o selecionar (aparece badge verde). Depois escolha um horário disponível. Se o profissional estiver disponível para esse horário, a seleção é confirmada automaticamente.
              </p>
            </div>
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

        {loadingSlots ? (
          <div className="flex flex-col items-center justify-center py-12 bg-blue-50 rounded-xl border-2 border-blue-300">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-3"></div>
            <p className="text-sm text-blue-700 font-medium">A carregar horários disponíveis...</p>
            <p className="text-xs text-blue-600 mt-1">Verificando agenda do profissional selecionado</p>
          </div>
        ) : (
          <>
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4 mb-3 shadow-sm">
              <p className="text-sm text-green-900 font-bold flex items-center mb-1">
                <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                Horários Agregados de Todos os Profissionais
              </p>
              <p className="text-xs text-green-700 ml-7">
                Mostrando todos os horários disponíveis. Clique num horário para escolher o profissional.
              </p>
            </div>
            <TimeSlotSelector
              timeSlots={timeSlots}
              selectedTime={formData.time}
              onTimeSelect={(time) => setFormData({ ...formData, time })}
              onSlotClick={handleTimeSlotClick}
              showProfessionalCount={true}
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
                <XCircle className="h-6 w-6" />
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