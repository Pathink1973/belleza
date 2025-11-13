import { format, addDays, setHours, setMinutes, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { ptLocale } from '../i18n';
import { supabase } from '../lib/supabase';

export interface BookingSlot {
  startTime: Date;
  endTime: Date;
  isAvailable: boolean;
}

export interface BookingAvailability {
  slots: BookingSlot[];
  error?: string;
}

export interface BookingStats {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  averageRating: number;
}

/**
 * Checks availability for a specific date and service
 */
export async function checkAvailability(
  professionalId: string,
  serviceId: string,
  date: string
): Promise<BookingAvailability> {
  try {
    // Get service duration
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('duration')
      .eq('id', serviceId)
      .single();

    if (serviceError) throw serviceError;

    // Get existing bookings for the date
    const dayStart = startOfDay(new Date(date));
    const dayEnd = endOfDay(new Date(date));

    const { data: existingBookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('professional_id', professionalId)
      .eq('status', 'confirmado')
      .gte('start_time', dayStart.toISOString())
      .lte('start_time', dayEnd.toISOString());

    if (bookingsError) throw bookingsError;

    // Generate available time slots
    const slots: BookingSlot[] = [];
    const durationInMinutes = parseInt(service.duration);
    
    // Business hours: 9 AM to 8 PM
    for (let hour = 9; hour < 20; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const startTime = new Date(date);
        startTime.setHours(hour, minute, 0, 0);

        const endTime = new Date(startTime);
        endTime.setMinutes(endTime.getMinutes() + durationInMinutes);

        // Check if slot is available
        const isAvailable = !existingBookings?.some(booking => {
          const bookingStart = new Date(booking.start_time);
          const bookingEnd = new Date(booking.end_time);
          return (
            (startTime >= bookingStart && startTime < bookingEnd) ||
            (endTime > bookingStart && endTime <= bookingEnd) ||
            (startTime <= bookingStart && endTime >= bookingEnd)
          );
        });

        slots.push({
          startTime,
          endTime,
          isAvailable,
        });
      }
    }

    return { slots };
  } catch (error) {
    console.error('Error checking availability:', error);
    return { slots: [], error: 'Failed to check availability' };
  }
}

/**
 * Creates a new booking
 */
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

/**
 * Updates a booking's status
 */
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

/**
 * Gets booking statistics for a professional
 */
export async function getBookingStats(professionalId: string): Promise<BookingStats> {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        service:services(price),
        reviews(rating)
      `)
      .eq('professional_id', professionalId);

    if (error) throw error;

    const stats = bookings?.reduce((acc, booking) => {
      // Count bookings by status
      acc.totalBookings++;
      switch (booking.status) {
        case 'concluído':
          acc.completedBookings++;
          acc.totalRevenue += booking.service?.price || 0;
          break;
        case 'cancelado':
          acc.cancelledBookings++;
          break;
        case 'pendente':
          acc.pendingBookings++;
          break;
      }

      // Calculate average rating
      if (booking.reviews && booking.reviews.length > 0) {
        const ratings = booking.reviews.map(r => r.rating).filter(Boolean);
        if (ratings.length > 0) {
          acc.totalRatings += ratings.reduce((sum, rating) => sum + rating, 0);
          acc.ratingCount += ratings.length;
        }
      }

      return acc;
    }, {
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      pendingBookings: 0,
      totalRevenue: 0,
      totalRatings: 0,
      ratingCount: 0
    });

    return {
      totalBookings: stats.totalBookings,
      completedBookings: stats.completedBookings,
      cancelledBookings: stats.cancelledBookings,
      pendingBookings: stats.pendingBookings,
      totalRevenue: stats.totalRevenue,
      averageRating: stats.ratingCount > 0 ? stats.totalRatings / stats.ratingCount : 0
    };
  } catch (error) {
    console.error('Error getting booking stats:', error);
    return {
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      pendingBookings: 0,
      totalRevenue: 0,
      averageRating: 0
    };
  }
}

/**
 * Formats a booking date according to locale
 */
export function formatBookingDate(date: Date | string, locale: string = 'pt'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return format(dateObj, 'PPp', {
    locale: locale === 'pt' ? ptLocale : undefined
  });
}

/**
 * Gets the next available dates for bookings
 */
export function getAvailableDates(daysAhead: number = 30): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  
  for (let i = 1; i <= daysAhead; i++) {
    const date = addDays(today, i);
    // Skip weekends
    if (date.getDay() !== 0 && date.getDay() !== 6) {
      dates.push(date);
    }
  }
  
  return dates;
}

/**
 * Validates if a booking time is valid
 */
export function isValidBookingTime(startTime: Date, endTime: Date): boolean {
  const now = new Date();
  const minDuration = 15; // minutes
  
  return (
    isAfter(startTime, now) && // Must be in the future
    isAfter(endTime, startTime) && // End must be after start
    (endTime.getTime() - startTime.getTime()) / (1000 * 60) >= minDuration // Minimum duration
  );
}

/**
 * Gets the status color for a booking
 */
export function getBookingStatusColor(status: string): string {
  switch (status) {
    case 'pendente':
      return 'bg-yellow-100 text-yellow-800';
    case 'confirmado':
      return 'bg-blue-100 text-blue-800';
    case 'concluído':
      return 'bg-green-100 text-green-800';
    case 'cancelado':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}