import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO
} from 'date-fns';
import { ptLocale } from '../i18n';
import { ChevronLeft, ChevronRight, Clock, User, AlertCircle, Calendar as CalendarIcon, CheckCircle2, XCircle, Users, Lock, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: 'pendente' | 'confirmado' | 'concluído' | 'cancelado';
  service: {
    title: string;
    price: number;
    duration: string;
  };
  client: {
    full_name: string;
    avatar_url: string | null;
    mobile_number: string;
  } | null;
}

interface MonthlyCalendarProps {
  bookings: Booking[];
  onDateClick: (date: Date) => void;
  selectedDate: Date;
  showArchived: boolean;
}

interface BlockedDate {
  id: string;
  professional_id: string;
  date: string;
  reason: string;
}

export function MonthlyCalendar({
  bookings,
  onDateClick,
  selectedDate,
  showArchived
}: MonthlyCalendarProps) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [updatedDates, setUpdatedDates] = useState<Set<string>>(new Set());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  useEffect(() => {
    if (user?.id) {
      fetchBlockedDates();
    }
  }, [user?.id, currentMonth]);

  const fetchBlockedDates = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('blocked_dates')
        .select('*')
        .eq('professional_id', user.id)
        .gte('date', format(monthStart, 'yyyy-MM-dd'))
        .lte('date', format(monthEnd, 'yyyy-MM-dd'));

      if (error) {
        console.error('Error fetching blocked dates:', error);
        return;
      }

      setBlockedDates(data || []);
      console.log('Blocked dates loaded for calendar:', data?.length || 0);
    } catch (err) {
      console.error('Error in fetchBlockedDates:', err);
    }
  };

  const isValidBooking = (booking: Booking): boolean => {
    return booking.client !== null && booking.service !== null;
  };

  const getClientName = (booking: Booking): string => {
    return booking.client?.full_name || 'Cliente Removido';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente':
        return 'bg-yellow-400 border-yellow-500';
      case 'confirmado':
        return 'bg-blue-500 border-blue-600';
      case 'concluído':
        return 'bg-green-500 border-green-600';
      case 'cancelado':
        return 'bg-red-400 border-red-500';
      default:
        return 'bg-gray-400 border-gray-500';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'pendente':
        return 'text-yellow-900';
      case 'confirmado':
        return 'text-white';
      case 'concluído':
        return 'text-white';
      case 'cancelado':
        return 'text-white';
      default:
        return 'text-gray-900';
    }
  };

  const getBookingsForDate = (date: Date) => {
    return bookings.filter((booking) => {
      const bookingDate = parseISO(booking.start_time);
      return isSameDay(date, bookingDate);
    });
  };

  // Calculate available professionals for a date using real-time data
  const [dailyAvailability, setDailyAvailability] = useState<Map<string, {available: number, total: number, percentage: number}>>(new Map());

  // Debounced refetch function to prevent excessive API calls
  const debouncedRefetch = useCallback((affectedDate?: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('[MonthlyCalendar] Debounced refetch triggered for:', affectedDate || 'entire month');

      if (affectedDate) {
        // Add visual feedback for updated date
        setUpdatedDates(prev => {
          const newSet = new Set(prev);
          newSet.add(affectedDate);
          return newSet;
        });

        // Remove the highlight after animation
        setTimeout(() => {
          setUpdatedDates(prev => {
            const newSet = new Set(prev);
            newSet.delete(affectedDate);
            return newSet;
          });
        }, 2000);
      }

      fetchDailyAvailabilityForMonth();
    }, 1000);
  }, []);

  useEffect(() => {
    fetchDailyAvailabilityForMonth();
  }, [currentMonth, bookings]);

  // Real-time subscription for booking changes
  useEffect(() => {
    const serviceIds = new Set(bookings.map(b => b.service?.id).filter(Boolean));
    if (serviceIds.size === 0) return;

    console.log('[MonthlyCalendar] Setting up realtime subscription for services:', serviceIds.size);

    // Clean up existing channel
    if (channelRef.current) {
      try {
        supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn('[MonthlyCalendar] Error removing old channel:', err);
      }
    }

    const channel = supabase
      .channel(`calendar-availability-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          console.log('[MonthlyCalendar] Realtime booking event:', payload.eventType, payload);

          // Handle all event types: INSERT, UPDATE, DELETE
          const booking = (payload.eventType === 'DELETE' ? payload.old : payload.new) as any;

          if (!booking || !booking.start_time) {
            console.warn('[MonthlyCalendar] Invalid booking data in realtime event');
            return;
          }

          // Extract date from booking
          const bookingDateStr = booking.start_time.split('T')[0];
          const bookingDate = parseISO(bookingDateStr);

          // Check if booking is within current month view
          if (bookingDate >= monthStart && bookingDate <= monthEnd) {
            console.log('[MonthlyCalendar] Booking change affects current month:', bookingDateStr);

            // Check if this booking is for one of the services we're tracking
            if (serviceIds.has(booking.service_id)) {
              console.log('[MonthlyCalendar] Service matches, triggering availability update');
              debouncedRefetch(bookingDateStr);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blocked_dates'
        },
        (payload) => {
          console.log('[MonthlyCalendar] Realtime blocked_dates event:', payload.eventType);

          const blockedDate = (payload.eventType === 'DELETE' ? payload.old : payload.new) as any;

          if (!blockedDate || !blockedDate.date) return;

          const dateObj = parseISO(blockedDate.date);

          if (dateObj >= monthStart && dateObj <= monthEnd) {
            console.log('[MonthlyCalendar] Blocked date change affects current month');

            // Refresh blocked dates
            if (user?.id && blockedDate.professional_id === user.id) {
              fetchBlockedDates();
              debouncedRefetch(blockedDate.date);
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[MonthlyCalendar] ✅ Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[MonthlyCalendar] ⚠️  Realtime subscription failed:', status);
        } else if (status === 'CLOSED') {
          console.log('[MonthlyCalendar] Realtime subscription closed');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[MonthlyCalendar] Cleaning up realtime subscription');

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      if (channelRef.current) {
        try {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        } catch (err) {
          console.warn('[MonthlyCalendar] Error during cleanup:', err);
        }
      }
    };
  }, [currentMonth, bookings, monthStart, monthEnd, user?.id, debouncedRefetch]);

  const fetchDailyAvailabilityForMonth = async () => {
    if (!user?.id) return;

    const availability = new Map<string, {available: number, total: number, percentage: number}>();

    const serviceIds = new Set(bookings.map(b => b.service?.id).filter(Boolean));

    if (serviceIds.size === 0) return;

    // CRITICAL FIX: Use the corrected get_service_daily_capacity_summary function
    // This now returns: total_slots = team_size × time_slots, available = total - confirmed

    for (const serviceId of Array.from(serviceIds)) {
      try {
        // Generate all dates in the month
        const currentDate = new Date(monthStart);
        const endDate = new Date(monthEnd);

        while (currentDate <= endDate) {
          const dateStr = format(currentDate, 'yyyy-MM-dd');

          // Use public function that works for all users (authenticated and anonymous)
          const { data, error } = await supabase.rpc('get_public_service_daily_capacity', {
            p_service_id: serviceId,
            p_date: dateStr
          });

          if (error) {
            console.error('Error fetching daily capacity:', error);
            currentDate.setDate(currentDate.getDate() + 1);
            continue;
          }

          if (data && data.length > 0) {
            const summary = data[0];
            const existing = availability.get(dateStr);

            // CORRECT AGGREGATION: Sum capacities across services
            if (!existing) {
              availability.set(dateStr, {
                available: summary.available_slots || 0,
                total: summary.total_slots || 0,
                percentage: summary.total_slots > 0
                  ? ((summary.available_slots / summary.total_slots) * 100)
                  : 0
              });
            } else {
              const newTotal = existing.total + (summary.total_slots || 0);
              const newAvailable = existing.available + (summary.available_slots || 0);
              availability.set(dateStr, {
                available: newAvailable,
                total: newTotal,
                percentage: newTotal > 0 ? ((newAvailable / newTotal) * 100) : 0
              });
            }
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }
      } catch (err) {
        console.error('Error fetching availability for service:', serviceId, err);
      }
    }

    console.log('[MonthlyCalendar] Daily availability loaded (FIXED):', {
      daysWithData: availability.size,
      sampleDay: availability.entries().next().value
    });

    setDailyAvailability(availability);
  };

  const getAvailableSlotsForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const data = dailyAvailability.get(dateStr);

    if (data) {
      return data;
    }

    // Fallback to default
    return {
      available: 1,
      total: 1,
      percentage: 100
    };
  };

  const isDateBlocked = (date: Date) => {
    return blockedDates.some(blocked => {
      const blockedDate = parseISO(blocked.date);
      return isSameDay(date, blockedDate);
    });
  };

  const getBlockedDateReason = (date: Date) => {
    const blocked = blockedDates.find(b => {
      const blockedDate = parseISO(b.date);
      return isSameDay(date, blockedDate);
    });
    return blocked?.reason;
  };

  const renderCalendar = () => {
    const rows = [];
    let days = [];
    let day = startDate;

    // Render week day headers
    const weekDaysHeader = [];
    const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    for (let i = 0; i < 7; i++) {
      weekDaysHeader.push(
        <div
          key={`header-${i}`}
          className="text-center py-4 text-sm font-black text-gray-700 uppercase tracking-wider bg-gradient-to-b from-gray-50 to-white"
        >
          {weekDays[i]}
        </div>
      );
    }

    rows.push(
      <div key="header" className="grid grid-cols-7 border-b-2 border-gray-200">
        {weekDaysHeader}
      </div>
    );

    // Render calendar days
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const currentDay = day;
        const dayBookings = getBookingsForDate(currentDay);
        const isCurrentMonth = isSameMonth(currentDay, monthStart);
        const isSelected = isSameDay(currentDay, selectedDate);
        const isTodayDay = isToday(currentDay);
        const isDayBlocked = isDateBlocked(currentDay);
        const blockedReason = getBlockedDateReason(currentDay);
        const activeBookings = dayBookings.filter(b =>
          showArchived ? true : ['pendente', 'confirmado'].includes(b.status)
        );

        const dayDateStr = format(currentDay, 'yyyy-MM-dd');
        const isDateUpdated = updatedDates.has(dayDateStr);

        days.push(
          <div
            key={day.toString()}
            className={`min-h-[130px] border-r border-b border-gray-200 p-3 cursor-pointer transition-all duration-300 hover:shadow-inner ${
              isDayBlocked
                ? 'bg-red-100/50 hover:bg-red-100 border-red-300 border-2'
                : !isCurrentMonth
                  ? 'bg-gray-50/50 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50'
                  : 'bg-white hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50'
            } ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/30' : ''} ${
              isDateUpdated ? 'ring-2 ring-green-400 ring-inset bg-green-50/30 animate-pulse' : ''
            }`}
            onClick={() => onDateClick(currentDay)}
            onMouseEnter={() => setHoveredDate(currentDay)}
            onMouseLeave={() => setHoveredDate(null)}
            title={isDayBlocked ? `DIA BLOQUEADO: ${blockedReason || 'Indisponível'}` : ''}
          >
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-2">
                <span
                  className={`text-sm font-bold transition-all duration-200 ${
                    isDayBlocked
                      ? 'text-red-700 w-8 h-8 flex items-center justify-center bg-red-200 rounded-lg line-through'
                      : isTodayDay
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-blue-300 ring-offset-1'
                      : isCurrentMonth
                      ? 'text-gray-900 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg'
                      : 'text-gray-400 w-8 h-8 flex items-center justify-center'
                  }`}
                >
                  {format(currentDay, 'd')}
                </span>
                {isDayBlocked ? (
                  <div className="flex items-center space-x-1 text-xs bg-red-200 text-red-700 px-2 py-1 rounded-full font-bold shadow-sm" title={`Bloqueado: ${blockedReason}`}>
                    <Ban className="h-3 w-3" />
                    <span>Bloqueado</span>
                  </div>
                ) : null}
              </div>

              <div className="flex-1 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                {activeBookings.slice(0, 3).map((booking) => {
                  if (!isValidBooking(booking)) {
                    console.warn('Skipping booking with invalid data:', booking.id);
                    return null;
                  }

                  const isArchived = ['concluído', 'cancelado'].includes(booking.status);
                  const clientName = getClientName(booking);
                  const hasClientData = booking.client !== null;

                  const isConfirmed = booking.status === 'confirmado';
                  const isPending = booking.status === 'pendente';

                  return (
                    <div
                      key={booking.id}
                      className={`text-xs p-2 rounded-lg border-l-3 ${getStatusColor(
                        booking.status
                      )} ${getStatusTextColor(booking.status)} ${
                        isArchived ? 'opacity-60' : ''
                      } hover:shadow-lg hover:scale-102 transition-all duration-200 group relative ${
                        isConfirmed ? 'ring-1 ring-blue-400 shadow-sm' : 'shadow-sm'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDateClick(currentDay);
                      }}
                    >
                      {isConfirmed && (
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 flex items-center justify-center" title="CONFIRMADO - Bloqueia disponibilidade para este profissional">
                          <div className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping opacity-75" />
                          <div className="relative w-1.5 h-1.5 bg-red-600 rounded-full shadow-sm">
                            <Lock className="h-1 w-1 text-white absolute top-0 left-0" />
                          </div>
                        </div>
                      )}
                      {isPending && (
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-500 rounded-full shadow-sm" title="PENDENTE - Não bloqueia disponibilidade (aguarda confirmação do profissional)"></div>
                      )}
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        <span className="font-medium truncate">
                          {format(parseISO(booking.start_time), 'HH:mm')}
                        </span>
                      </div>
                      <div className="truncate font-semibold mt-0.5">
                        {booking.service.title}
                      </div>
                      <div className="flex items-center space-x-1 mt-0.5 opacity-90">
                        <User className="h-3 w-3 flex-shrink-0" />
                        <span className={`truncate text-xs ${!hasClientData ? 'italic' : ''}`}>
                          {clientName}
                        </span>
                      </div>

                      {/* Tooltip on hover */}
                      {hoveredDate && isSameDay(hoveredDate, currentDay) && (
                        <div className="absolute left-0 top-full mt-1 z-50 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg min-w-[200px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="font-semibold">{booking.service.title}</div>
                          <div className="mt-1">{t('bookings.info.client')}: {clientName}</div>
                          <div>
                            Horário: {format(parseISO(booking.start_time), 'HH:mm')} -{' '}
                            {format(parseISO(booking.end_time), 'HH:mm')}
                          </div>
                          <div>Status: {booking.status}</div>
                        </div>
                      )}
                    </div>
                  );
                }).filter(Boolean)}

                {activeBookings.length > 3 && (
                  <div className="text-xs text-blue-600 text-center py-2 font-bold bg-blue-50 rounded-lg border border-blue-200 mt-1">
                    +{activeBookings.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          </div>
        );

        day = addDays(day, 1);
      }

      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>
      );
      days = [];
    }

    return rows;
  };

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onDateClick(today);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
      {/* Calendar Header */}
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 px-3 sm:px-6 py-3 sm:py-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <button
              onClick={previousMonth}
              className="p-1.5 sm:p-2.5 hover:bg-white/20 rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm"
              title="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-lg" />
            </button>
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white capitalize drop-shadow-lg tracking-tight">
                <span className="hidden sm:inline">{format(currentMonth, 'MMMM yyyy', { locale: ptLocale })}</span>
                <span className="sm:hidden">{format(currentMonth, 'MMM yy', { locale: ptLocale })}</span>
              </h2>
            </div>
            <button
              onClick={nextMonth}
              className="p-1.5 sm:p-2.5 hover:bg-white/20 rounded-lg sm:rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm"
              title="Próximo mês"
            >
              <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 text-white drop-shadow-lg" />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-2 sm:px-5 sm:py-2.5 bg-white/25 hover:bg-white/35 text-white rounded-lg sm:rounded-xl text-sm sm:text-base font-bold transition-all duration-200 backdrop-blur-md shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 border border-white/30"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b-2 border-gray-200 space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-yellow-200 shadow-sm">
            <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-md sm:rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-yellow-500 shadow-sm"></div>
            <span className="text-gray-800 font-bold text-[10px] sm:text-xs">Pendente</span>
            <span className="hidden sm:inline text-gray-500 text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">(aguarda)</span>
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-blue-200 shadow-sm">
            <div className="relative w-3 h-3 sm:w-4 sm:h-4 rounded-md sm:rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-blue-600 shadow-sm">
              <div className="absolute -right-0.5 sm:-right-1 -top-0.5 sm:-top-1 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full border border-white shadow-sm"></div>
            </div>
            <span className="text-gray-800 font-bold text-[10px] sm:text-xs">Confirmado</span>
            <span className="hidden sm:inline text-gray-500 text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">(bloqueia)</span>
          </div>
          {showArchived && (
            <>
              <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-green-200 shadow-sm">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-md sm:rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-green-600 shadow-sm flex items-center justify-center">
                  <CheckCircle2 className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-white" />
                </div>
                <span className="text-gray-800 font-bold text-[10px] sm:text-xs">Concluido</span>
              </div>
              <div className="flex items-center space-x-1.5 sm:space-x-2 bg-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border border-red-200 shadow-sm">
                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-md sm:rounded-lg bg-gradient-to-br from-red-400 to-red-500 border-2 border-red-500 shadow-sm flex items-center justify-center">
                  <XCircle className="h-2 w-2 sm:h-2.5 sm:w-2.5 text-white" />
                </div>
                <span className="text-gray-800 font-bold text-[10px] sm:text-xs">Cancelado</span>
              </div>
            </>
          )}
        </div>
        {!showArchived && (
          <div className="space-y-2">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg sm:rounded-xl p-2 sm:p-3 flex items-start space-x-2 sm:space-x-3 shadow-sm">
              <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] sm:text-xs text-green-900 leading-relaxed">
                  <span className="font-bold hidden sm:inline">Reservas confirmadas</span>
                  <span className="font-bold sm:hidden">Confirmadas</span> bloqueiam horários.
                  <span className="font-bold hidden sm:inline">Reservas pendentes</span>
                  <span className="font-bold sm:hidden">Pendentes</span> NÃO bloqueiam<span className="hidden sm:inline"> e podem ser sobrepostas até serem confirmadas</span>.
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-lg sm:rounded-xl p-2 sm:p-3 flex items-start space-x-2 sm:space-x-3 shadow-sm">
              <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-md sm:rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <Users className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] sm:text-xs text-blue-900 leading-relaxed">
                  <span className="font-bold">Sistema de Capacidade:</span> Quando todos os profissionais têm reservas confirmadas no mesmo horário, esse horário fica <span className="font-bold">bloqueado</span> para novas reservas.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">{renderCalendar()}</div>
    </div>
  );
}
