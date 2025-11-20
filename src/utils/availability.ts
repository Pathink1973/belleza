import { supabase } from '../lib/supabase';
import { parseISO, format, isAfter, isBefore } from 'date-fns';

export interface ServiceCapacity {
  serviceId: string;
  totalCapacity: number;
  serviceName: string;
  professionalName: string;
  team: any[];
}

export interface SlotAvailability {
  totalCapacity: number;
  occupiedCount: number;
  availableCount: number;
  isAvailable: boolean;
  utilizationPercentage: number;
  blockedReason?: string;
}

export interface TimeSlotWithCapacity {
  time: string;
  isAvailable: boolean;
  totalCapacity: number;
  availableCapacity: number;
  utilizationPercentage: number;
  blockedReason?: string;
}

export async function getServiceCapacity(serviceId: string): Promise<ServiceCapacity | null> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select(`
        id,
        title,
        team,
        professional:profiles!services_professional_id_fkey(
          full_name
        )
      `)
      .eq('id', serviceId)
      .single();

    if (error) {
      console.error('Error fetching service capacity:', error);
      return null;
    }

    if (!data) return null;

    const totalCapacity = data.team && Array.isArray(data.team) && data.team.length > 0
      ? data.team.length
      : 1;

    return {
      serviceId: data.id,
      totalCapacity,
      serviceName: data.title,
      professionalName: data.professional?.full_name || 'Profissional',
      team: data.team || []
    };
  } catch (err) {
    console.error('Error in getServiceCapacity:', err);
    return null;
  }
}

export async function checkSlotAvailability(
  serviceId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<SlotAvailability> {
  try {
    const { data, error } = await supabase
      .rpc('get_service_aggregate_capacity', {
        p_service_id: serviceId,
        p_date: date,
        p_start_time: startTime,
        p_end_time: endTime
      });

    if (error) {
      console.error('Error checking slot availability:', error);
      return {
        totalCapacity: 1,
        occupiedCount: 0,
        availableCount: 1,
        isAvailable: true,
        utilizationPercentage: 0
      };
    }

    if (!data || data.length === 0) {
      return {
        totalCapacity: 1,
        occupiedCount: 0,
        availableCount: 1,
        isAvailable: true,
        utilizationPercentage: 0
      };
    }

    const result = data[0];

    return {
      totalCapacity: result.total_capacity || 1,
      occupiedCount: result.occupied_count || 0,
      availableCount: result.available_count || 0,
      isAvailable: result.is_available || false,
      utilizationPercentage: result.utilization_percentage || 0,
      blockedReason: result.blocked_reason || undefined
    };
  } catch (err) {
    console.error('Error in checkSlotAvailability:', err);
    return {
      totalCapacity: 1,
      occupiedCount: 0,
      availableCount: 1,
      isAvailable: true,
      utilizationPercentage: 0
    };
  }
}

export async function quickCheckAvailability(
  serviceId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  try {
    const result = await checkSlotAvailability(serviceId, date, startTime, endTime);
    return result.isAvailable;
  } catch (err) {
    console.error('Error in quickCheckAvailability:', err);
    return true;
  }
}

export async function confirmBookingWithCapacityCheck(
  bookingId: string
): Promise<{
  success: boolean;
  message: string;
  assignedTo?: string;
}> {
  try {
    const { data, error } = await supabase
      .rpc('confirm_booking_with_capacity_check', {
        p_booking_id: bookingId
      });

    if (error) {
      console.error('Error confirming booking:', error);
      return {
        success: false,
        message: error.message || 'Erro ao confirmar reserva'
      };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        message: 'Erro ao confirmar reserva'
      };
    }

    const result = data[0];

    return {
      success: result.success,
      message: result.message,
      assignedTo: result.assigned_to
    };
  } catch (err) {
    console.error('Error in confirmBookingWithCapacityCheck:', err);
    return {
      success: false,
      message: 'Erro ao confirmar reserva'
    };
  }
}

export function getCapacityColor(utilizationPercentage: number): string {
  if (utilizationPercentage === 0) {
    return 'green';
  } else if (utilizationPercentage < 50) {
    return 'green';
  } else if (utilizationPercentage < 80) {
    return 'amber';
  } else if (utilizationPercentage < 100) {
    return 'orange';
  } else {
    return 'red';
  }
}

export function getCapacityColorClasses(utilizationPercentage: number): {
  bg: string;
  text: string;
  border: string;
  ring: string;
} {
  const color = getCapacityColor(utilizationPercentage);

  const colorMap = {
    green: {
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-300',
      ring: 'ring-green-500'
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-300',
      ring: 'ring-amber-500'
    },
    orange: {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-300',
      ring: 'ring-orange-500'
    },
    red: {
      bg: 'bg-red-50',
      text: 'text-red-700',
      border: 'border-red-300',
      ring: 'ring-red-500'
    }
  };

  return colorMap[color];
}

export function getCapacityIcon(utilizationPercentage: number): string {
  if (utilizationPercentage === 0) {
    return '✓✓✓';
  } else if (utilizationPercentage < 50) {
    return '✓✓';
  } else if (utilizationPercentage < 80) {
    return '✓';
  } else if (utilizationPercentage < 100) {
    return '⚠';
  } else {
    return '✗';
  }
}

export function getCapacityLabel(availableCount: number, totalCapacity: number): string {
  if (availableCount === 0) {
    return 'Esgotado';
  } else if (availableCount === 1) {
    return '1 vaga';
  } else if (availableCount === totalCapacity) {
    return `${totalCapacity} ${totalCapacity === 1 ? 'vaga' : 'vagas'}`;
  } else {
    return `${availableCount} vagas`;
  }
}

export async function calculateDayCapacity(
  serviceId: string,
  date: string
): Promise<{
  totalSlots: number;
  availableSlots: number;
  bookedSlots: number;
  utilizationPercentage: number;
}> {
  try {
    const slots = [];

    for (let hour = 9; hour <= 19; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const endHour = minute === 30 ? hour + 1 : hour;
        const endMinute = minute === 30 ? 0 : 30;
        const endTime = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;

        slots.push({ time, endTime });
      }
    }

    const availabilityChecks = await Promise.all(
      slots.map(slot => checkSlotAvailability(serviceId, date, slot.time, slot.endTime))
    );

    const totalSlots = slots.length;
    const availableSlots = availabilityChecks.filter(check => check.isAvailable).length;
    const bookedSlots = totalSlots - availableSlots;
    const utilizationPercentage = totalSlots > 0
      ? Math.round((bookedSlots / totalSlots) * 100)
      : 0;

    return {
      totalSlots,
      availableSlots,
      bookedSlots,
      utilizationPercentage
    };
  } catch (err) {
    console.error('Error calculating day capacity:', err);
    return {
      totalSlots: 0,
      availableSlots: 0,
      bookedSlots: 0,
      utilizationPercentage: 0
    };
  }
}

export async function checkPublicSlotAvailability(
  serviceId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<SlotAvailability> {
  try {
    const { data, error } = await supabase
      .rpc('get_public_service_time_slot_availability', {
        p_service_id: serviceId,
        p_date: date,
        p_start_time: startTime,
        p_end_time: endTime
      });

    if (error) {
      console.error('Error checking public slot availability:', error);
      return {
        totalCapacity: 1,
        occupiedCount: 0,
        availableCount: 1,
        isAvailable: true,
        utilizationPercentage: 0
      };
    }

    if (!data || data.length === 0) {
      return {
        totalCapacity: 1,
        occupiedCount: 0,
        availableCount: 1,
        isAvailable: true,
        utilizationPercentage: 0
      };
    }

    const result = data[0];

    return {
      totalCapacity: result.total_capacity || 1,
      occupiedCount: result.occupied_count || 0,
      availableCount: result.available_capacity || 0,
      isAvailable: result.is_available || false,
      utilizationPercentage: result.utilization_percentage || 0
    };
  } catch (err) {
    console.error('Error in checkPublicSlotAvailability:', err);
    return {
      totalCapacity: 1,
      occupiedCount: 0,
      availableCount: 1,
      isAvailable: true,
      utilizationPercentage: 0
    };
  }
}

export async function getPublicDailyCapacity(
  serviceId: string,
  date: string
): Promise<{
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  utilizationPercentage: number;
}> {
  try {
    const { data, error } = await supabase
      .rpc('get_public_service_daily_capacity', {
        p_service_id: serviceId,
        p_date: date
      });

    if (error) {
      console.error('Error fetching public daily capacity:', error);
      return {
        totalSlots: 0,
        availableSlots: 0,
        occupiedSlots: 0,
        utilizationPercentage: 0
      };
    }

    if (!data || data.length === 0) {
      return {
        totalSlots: 0,
        availableSlots: 0,
        occupiedSlots: 0,
        utilizationPercentage: 0
      };
    }

    const result = data[0];

    return {
      totalSlots: result.total_slots || 0,
      availableSlots: result.available_slots || 0,
      occupiedSlots: result.occupied_slots || 0,
      utilizationPercentage: result.utilization_percentage || 0
    };
  } catch (err) {
    console.error('Error in getPublicDailyCapacity:', err);
    return {
      totalSlots: 0,
      availableSlots: 0,
      occupiedSlots: 0,
      utilizationPercentage: 0
    };
  }
}

export async function getPublicServiceCapacity(serviceId: string): Promise<ServiceCapacity | null> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select(`
        id,
        title,
        team,
        professional:profiles!services_professional_id_fkey(
          full_name
        )
      `)
      .eq('id', serviceId)
      .single();

    if (error) {
      console.error('Error fetching public service capacity:', error);
      return null;
    }

    if (!data) return null;

    const totalCapacity = data.team && Array.isArray(data.team) && data.team.length > 0
      ? data.team.length
      : 1;

    return {
      serviceId: data.id,
      totalCapacity,
      serviceName: data.title,
      professionalName: data.professional?.full_name || 'Profissional',
      team: data.team || []
    };
  } catch (err) {
    console.error('Error in getPublicServiceCapacity:', err);
    return null;
  }
}
