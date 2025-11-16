import { supabase } from './supabase';

export interface BookingSlot {
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
}

export interface BookingAvailability {
  slots: BookingSlot[];
  error?: string;
}

export async function checkAvailability(
  professionalId: string,
  serviceId: string,
  date: string
): Promise<BookingAvailability> {
  try {
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('duration')
      .eq('id', serviceId)
      .single();

    if (serviceError) throw serviceError;

    const dayOfWeek = new Date(date).getDay();

    const { data: availabilitySlots, error: availabilityError } = await supabase
      .from('availability')
      .select('*')
      .eq('professional_id', professionalId)
      .eq('day_of_week', dayOfWeek)
      .eq('is_available', true);

    if (availabilityError) throw availabilityError;

    const { data: blockedDates, error: blockedError } = await supabase
      .from('blocked_dates')
      .select('date, reason')
      .eq('professional_id', professionalId)
      .eq('date', date)
      .maybeSingle();

    if (blockedError) throw blockedError;

    if (blockedDates) {
      console.log(`Date ${date} is blocked for professional ${professionalId}. Reason: ${blockedDates.reason || 'Not specified'}`);
      return { slots: [], error: `This date is blocked: ${blockedDates.reason || 'Date unavailable'}` };
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: existingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('status', 'confirmado')
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString());

    if (bookingsError) throw bookingsError;

    const slots: BookingSlot[] = [];
    const durationInMinutes = parseInt(service.duration);

    if (!availabilitySlots || availabilitySlots.length === 0) {
      for (let hour = 9; hour < 17; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startTime = new Date(date);
          startTime.setHours(hour, minute, 0, 0);

          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + durationInMinutes);

          const isAvailable = !existingBookings?.some(booking => {
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            return (
              (startTime >= bookingStart && startTime < bookingEnd) ||
              (endTime > bookingStart && endTime <= bookingEnd) ||
              (startTime <= bookingStart && endTime >= bookingEnd)
            );
          });

          slots.push({ startTime, endTime, isAvailable });
        }
      }
    } else {
      for (const availSlot of availabilitySlots) {
        const [startHour, startMinute] = availSlot.start_time.split(':').map(Number);
        const [endHour, endMinute] = availSlot.end_time.split(':').map(Number);

        const slotStartMinutes = startHour * 60 + startMinute;
        const slotEndMinutes = endHour * 60 + endMinute;

        for (let currentMinutes = slotStartMinutes; currentMinutes < slotEndMinutes; currentMinutes += 30) {
          const hour = Math.floor(currentMinutes / 60);
          const minute = currentMinutes % 60;

          const startTime = new Date(date);
          startTime.setHours(hour, minute, 0, 0);

          const endTime = new Date(startTime);
          endTime.setMinutes(endTime.getMinutes() + durationInMinutes);

          if (endTime.getHours() * 60 + endTime.getMinutes() > slotEndMinutes) {
            continue;
          }

          const isAvailable = !existingBookings?.some(booking => {
            const bookingStart = new Date(booking.start_time);
            const bookingEnd = new Date(booking.end_time);
            return (
              (startTime >= bookingStart && startTime < bookingEnd) ||
              (endTime > bookingStart && endTime <= bookingEnd) ||
              (startTime <= bookingStart && endTime >= bookingEnd)
            );
          });

          slots.push({ startTime, endTime, isAvailable });
        }
      }
    }

    return { slots };
  } catch (error) {
    console.error('Error checking availability:', error);
    return { slots: [], error: 'Failed to check availability' };
  }
}

export async function createBooking(
  serviceId: string,
  professionalId: string,
  clientId: string,
  startTime: Date,
  endTime: Date
) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .insert([
        {
          service_id: serviceId,
          professional_id: professionalId,
          client_id: clientId,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          status: 'pendente'
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return { booking: data, error: null };
  } catch (error) {
    console.error('Error creating booking:', error);
    return { booking: null, error: 'Failed to create booking' };
  }
}

export async function updateBookingStatus(
  bookingId: string,
  status: 'confirmado' | 'cancelado' | 'concluído'
) {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) throw error;
    return { booking: data, error: null };
  } catch (error) {
    console.error('Error updating booking status:', error);
    return { booking: null, error: 'Failed to update booking status' };
  }
}