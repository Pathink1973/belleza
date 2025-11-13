import { supabase } from '../lib/supabase';
import { startOfMonth, endOfMonth, eachDayOfInterval, format } from 'date-fns';
import { ptLocale } from '../i18n';

interface DailyStats {
  date: string;
  bookings: number;
  revenue: number;
  completedBookings: number;
  cancelledBookings: number;
}

interface MonthlyStats {
  totalBookings: number;
  totalRevenue: number;
  averageBookingsPerDay: number;
  averageRevenuePerDay: number;
  completionRate: number;
  cancellationRate: number;
  dailyStats: DailyStats[];
}

/**
 * Gets monthly analytics for a professional
 */
export async function getMonthlyAnalytics(professionalId: string, month: Date = new Date()): Promise<MonthlyStats> {
  try {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    
    // Get all bookings for the month
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        id,
        start_time,
        status,
        service:services(price)
      `)
      .eq('professional_id', professionalId)
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());

    if (error) throw error;

    // Generate daily stats
    const days = eachDayOfInterval({ start, end });
    const dailyStats = days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayBookings = bookings?.filter(b => 
        format(new Date(b.start_time), 'yyyy-MM-dd') === dayStr
      ) || [];
      
      return {
        date: format(day, 'MMM dd', { locale: ptLocale }),
        bookings: dayBookings.length,
        revenue: dayBookings.reduce((sum, b) => sum + (b.service?.price || 0), 0),
        completedBookings: dayBookings.filter(b => b.status === 'concluído').length,
        cancelledBookings: dayBookings.filter(b => b.status === 'cancelado').length
      };
    });

    // Calculate monthly totals
    const totalBookings = bookings?.length || 0;
    const totalRevenue = bookings?.reduce((sum, b) => sum + (b.service?.price || 0), 0) || 0;
    const completedBookings = bookings?.filter(b => b.status === 'concluído').length || 0;
    const cancelledBookings = bookings?.filter(b => b.status === 'cancelado').length || 0;

    return {
      totalBookings,
      totalRevenue,
      averageBookingsPerDay: totalBookings / days.length,
      averageRevenuePerDay: totalRevenue / days.length,
      completionRate: totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
      cancellationRate: totalBookings > 0 ? (cancelledBookings / totalBookings) * 100 : 0,
      dailyStats
    };
  } catch (error) {
    console.error('Error getting monthly analytics:', error);
    throw error;
  }
}

/**
 * Gets revenue trends
 */
export async function getRevenueTrends(professionalId: string, months: number = 6) {
  try {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - months);

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        start_time,
        service:services(price)
      `)
      .eq('professional_id', professionalId)
      .eq('status', 'concluído')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());

    if (error) throw error;

    const monthlyRevenue = new Map<string, number>();
    
    data?.forEach(booking => {
      const month = format(new Date(booking.start_time), 'MMM yyyy', { locale: ptLocale });
      const currentRevenue = monthlyRevenue.get(month) || 0;
      monthlyRevenue.set(month, currentRevenue + (booking.service?.price || 0));
    });

    return Array.from(monthlyRevenue.entries()).map(([month, revenue]) => ({
      month,
      revenue
    }));
  } catch (error) {
    console.error('Error getting revenue trends:', error);
    throw error;
  }
}