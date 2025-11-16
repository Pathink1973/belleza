import { supabase } from '../lib/supabase';
import { startOfDay, endOfDay, format } from 'date-fns';

// Simple cache with 30 second TTL
interface CacheEntry {
  data: ServiceAvailabilityStatus | null;
  timestamp: number;
}

const availabilityCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30000; // 30 seconds

function getCacheKey(serviceId: string, date: string): string {
  return `${serviceId}:${date}`;
}

function getCachedAvailability(serviceId: string, date: string): ServiceAvailabilityStatus | null {
  const cacheKey = getCacheKey(serviceId, date);
  const cached = availabilityCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    console.log(`[CACHE HIT] Service ${serviceId} for date ${date}`);
    return cached.data;
  }

  return null;
}

function setCachedAvailability(serviceId: string, date: string, data: ServiceAvailabilityStatus | null): void {
  const cacheKey = getCacheKey(serviceId, date);
  availabilityCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

/**
 * Clears the availability cache
 * Call this when bookings change to force refresh
 */
export function clearAvailabilityCache(): void {
  availabilityCache.clear();
  console.log('[CACHE] Cleared availability cache');
}

export interface ServiceAvailabilityStatus {
  serviceId: string;
  totalCapacity: number;
  currentBookings: number;
  availableSlots: number;
  utilizationPercentage: number;
  status: 'available' | 'limited' | 'busy' | 'full';
  statusColor: 'green' | 'yellow' | 'orange' | 'red';
  statusText: string;
  nextAvailableDate?: string;
}

export interface DailyAvailability {
  date: string;
  totalCapacity: number;
  bookedSlots: number;
  availableSlots: number;
  isFullyBooked: boolean;
}

/**
 * Calcula a disponibilidade atual de um serviço
 * Conta apenas reservas CONFIRMADAS como bloqueios
 */
export async function getServiceCurrentAvailability(
  serviceId: string,
  dateToCheck?: string
): Promise<ServiceAvailabilityStatus | null> {
  try {
    const checkDate = dateToCheck || format(new Date(), 'yyyy-MM-dd');

    // Check cache first
    const cached = getCachedAvailability(serviceId, checkDate);
    if (cached !== null) {
      return cached;
    }

    // 1. Get service and team information
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select(`
        id,
        professional_id,
        team
      `)
      .eq('id', serviceId)
      .single();

    if (serviceError || !service) {
      console.error('Error fetching service:', serviceError);
      return null;
    }

    // 2. Calculate total capacity (number of professionals who can perform the service)
    let totalCapacity = 1;

    if (service.team && Array.isArray(service.team) && service.team.length > 0) {
      totalCapacity = service.team.length;
    }

    // 3. Check for blocked dates
    const dayStart = startOfDay(new Date(checkDate));
    const dayEnd = endOfDay(new Date(checkDate));

    const { data: blockedDates } = await supabase
      .from('blocked_dates')
      .select('professional_id, date')
      .eq('date', checkDate);

    const blockedProfessionalIds = new Set(
      (blockedDates || []).map(bd => bd.professional_id)
    );

    // Check if ALL professionals are blocked for this day
    const professionalIds: string[] = [];
    if (service.team && Array.isArray(service.team) && service.team.length > 0) {
      service.team.forEach((member: any) => {
        if (member.is_primary && member.profile_id) {
          professionalIds.push(member.profile_id);
        } else if (member.profile_id) {
          professionalIds.push(member.profile_id);
        }
      });
    } else {
      professionalIds.push(service.professional_id);
    }

    const allProfessionalsBlocked = professionalIds.every(id =>
      blockedProfessionalIds.has(id)
    );

    if (allProfessionalsBlocked) {
      return {
        serviceId,
        totalCapacity,
        currentBookings: totalCapacity,
        availableSlots: 0,
        utilizationPercentage: 100,
        status: 'full',
        statusColor: 'red',
        statusText: 'Indisponível hoje',
        nextAvailableDate: undefined
      };
    }

    // 4. Count confirmed bookings for today
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, start_time, end_time, professional_id, team_member_id')
      .eq('service_id', serviceId)
      .eq('status', 'confirmado')
      .gte('start_time', dayStart.toISOString())
      .lt('start_time', dayEnd.toISOString());

    if (bookingsError) {
      console.error('Error fetching bookings:', bookingsError);
    }

    const confirmedBookings = bookings || [];

    // Count unique time slots that are occupied
    // A time slot is considered occupied if ANY professional is booked during that time
    const occupiedSlots = new Set<string>();

    confirmedBookings.forEach(booking => {
      const slotKey = format(new Date(booking.start_time), 'HH:mm');
      occupiedSlots.add(slotKey);
    });

    const currentBookings = occupiedSlots.size;

    // Estimate total slots available in a day (assuming 9-20h with 30min intervals)
    const estimatedDailySlots = 22; // (20-9)*2 = 22 slots

    // Calculate available slots considering capacity
    const maxDailyCapacity = estimatedDailySlots * totalCapacity;
    const totalOccupiedCapacity = currentBookings;
    const availableSlots = maxDailyCapacity - totalOccupiedCapacity;

    // Calculate utilization percentage
    const utilizationPercentage = Math.round((totalOccupiedCapacity / maxDailyCapacity) * 100);

    // Determine status based on utilization
    let status: 'available' | 'limited' | 'busy' | 'full';
    let statusColor: 'green' | 'yellow' | 'orange' | 'red';
    let statusText: string;

    if (availableSlots === 0) {
      status = 'full';
      statusColor = 'red';
      statusText = 'Esgotado';
    } else if (utilizationPercentage === 0) {
      status = 'available';
      statusColor = 'green';
      statusText = `${totalCapacity} ${totalCapacity === 1 ? 'profissional disponível' : 'profissionais disponíveis'}`;
    } else if (utilizationPercentage < 50) {
      status = 'available';
      statusColor = 'green';
      statusText = 'Muitas vagas disponíveis';
    } else if (utilizationPercentage < 75) {
      status = 'limited';
      statusColor = 'yellow';
      statusText = 'Vagas limitadas';
    } else if (utilizationPercentage < 95) {
      status = 'busy';
      statusColor = 'orange';
      statusText = 'Últimas vagas!';
    } else {
      status = 'full';
      statusColor = 'red';
      statusText = 'Quase esgotado';
    }

    const result: ServiceAvailabilityStatus = {
      serviceId,
      totalCapacity,
      currentBookings: totalOccupiedCapacity,
      availableSlots,
      utilizationPercentage,
      status,
      statusColor,
      statusText
    };

    // Cache the result
    setCachedAvailability(serviceId, checkDate, result);

    return result;
  } catch (error) {
    console.error('Error calculating service availability:', error);
    // Cache null result to prevent repeated failures
    setCachedAvailability(serviceId, dateToCheck || format(new Date(), 'yyyy-MM-dd'), null);
    return null;
  }
}

/**
 * Get daily availability summary for a service across multiple dates
 */
export async function getServiceDailyAvailability(
  serviceId: string,
  startDate: string,
  endDate: string
): Promise<DailyAvailability[]> {
  try {
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('id, professional_id, team')
      .eq('id', serviceId)
      .single();

    if (serviceError || !service) {
      console.error('Error fetching service:', serviceError);
      return [];
    }

    let totalCapacity = 1;
    if (service.team && Array.isArray(service.team) && service.team.length > 0) {
      totalCapacity = service.team.length;
    }

    // Get all bookings in the date range
    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_time')
      .eq('service_id', serviceId)
      .eq('status', 'confirmado')
      .gte('start_time', new Date(startDate).toISOString())
      .lt('start_time', new Date(endDate).toISOString());

    // Group bookings by date
    const bookingsByDate = new Map<string, number>();

    (bookings || []).forEach(booking => {
      const bookingDate = format(new Date(booking.start_time), 'yyyy-MM-dd');
      const count = bookingsByDate.get(bookingDate) || 0;
      bookingsByDate.set(bookingDate, count + 1);
    });

    // Generate daily availability
    const dailyAvailability: DailyAvailability[] = [];
    const estimatedDailySlots = 22;
    const maxDailyCapacity = estimatedDailySlots * totalCapacity;

    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const bookedSlots = bookingsByDate.get(dateStr) || 0;
      const availableSlots = maxDailyCapacity - bookedSlots;

      dailyAvailability.push({
        date: dateStr,
        totalCapacity,
        bookedSlots,
        availableSlots,
        isFullyBooked: availableSlots <= 0
      });
    }

    return dailyAvailability;
  } catch (error) {
    console.error('Error getting daily availability:', error);
    return [];
  }
}

/**
 * Gets color class based on availability percentage
 */
export function getAvailabilityColorClass(utilizationPercentage: number): string {
  if (utilizationPercentage === 0) return 'bg-green-100 text-green-800 border-green-300';
  if (utilizationPercentage < 50) return 'bg-green-100 text-green-800 border-green-300';
  if (utilizationPercentage < 75) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (utilizationPercentage < 95) return 'bg-orange-100 text-orange-800 border-orange-300';
  return 'bg-red-100 text-red-800 border-red-300';
}

/**
 * Gets icon color based on status
 */
export function getAvailabilityIconColor(statusColor: string): string {
  switch (statusColor) {
    case 'green': return 'text-green-600';
    case 'yellow': return 'text-yellow-600';
    case 'orange': return 'text-orange-600';
    case 'red': return 'text-red-600';
    default: return 'text-gray-600';
  }
}
