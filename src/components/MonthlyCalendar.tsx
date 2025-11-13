import { useState, useEffect } from 'react';
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
import { ChevronLeft, ChevronRight, Clock, User, AlertCircle, Calendar as CalendarIcon, CheckCircle2, XCircle } from 'lucide-react';

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

export function MonthlyCalendar({
  bookings,
  onDateClick,
  selectedDate,
  showArchived
}: MonthlyCalendarProps) {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

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
        const activeBookings = dayBookings.filter(b =>
          showArchived ? true : ['pendente', 'confirmado'].includes(b.status)
        );

        days.push(
          <div
            key={day.toString()}
            className={`min-h-[130px] border-r border-b border-gray-200 p-3 cursor-pointer transition-all duration-200 hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 hover:shadow-inner ${
              !isCurrentMonth ? 'bg-gray-50/50' : 'bg-white'
            } ${isSelected ? 'ring-2 ring-blue-500 ring-inset bg-blue-50/30' : ''}`}
            onClick={() => onDateClick(currentDay)}
            onMouseEnter={() => setHoveredDate(currentDay)}
            onMouseLeave={() => setHoveredDate(null)}
          >
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-2">
                <span
                  className={`text-sm font-bold transition-all duration-200 ${
                    isTodayDay
                      ? 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white w-8 h-8 rounded-xl flex items-center justify-center shadow-lg ring-2 ring-blue-300 ring-offset-1'
                      : isCurrentMonth
                      ? 'text-gray-900 w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg'
                      : 'text-gray-400 w-8 h-8 flex items-center justify-center'
                  }`}
                >
                  {format(currentDay, 'd')}
                </span>
                {activeBookings.length > 0 && (
                  <span className="text-xs bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-2.5 py-1 rounded-full font-bold shadow-sm">
                    {activeBookings.length}
                  </span>
                )}
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
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 flex items-center justify-center" title="Bloqueia disponibilidade">
                          <div className="absolute w-2 h-2 bg-red-500 rounded-full animate-ping opacity-75" />
                          <div className="relative w-1.5 h-1.5 bg-red-600 rounded-full shadow-sm" />
                        </div>
                      )}
                      {isPending && (
                        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 bg-yellow-500 rounded-full shadow-sm" title="Não bloqueia - aguarda confirmação"></div>
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
      <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-cyan-600 px-6 py-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={previousMonth}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm"
              title="Mês anterior"
            >
              <ChevronLeft className="h-6 w-6 text-white drop-shadow-lg" />
            </button>
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <CalendarIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-2xl font-black text-white capitalize drop-shadow-lg tracking-tight">
                {format(currentMonth, 'MMMM yyyy', { locale: ptLocale })}
              </h2>
            </div>
            <button
              onClick={nextMonth}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all duration-200 hover:scale-110 active:scale-95 backdrop-blur-sm"
              title="Próximo mês"
            >
              <ChevronRight className="h-6 w-6 text-white drop-shadow-lg" />
            </button>
          </div>
          <button
            onClick={goToToday}
            className="px-5 py-2.5 bg-white/25 hover:bg-white/35 text-white rounded-xl font-bold transition-all duration-200 backdrop-blur-md shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 border border-white/30"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-4 bg-gradient-to-r from-gray-50 via-white to-gray-50 border-b-2 border-gray-200 space-y-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-yellow-200 shadow-sm">
            <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 border-2 border-yellow-500 shadow-sm"></div>
            <span className="text-gray-800 font-bold">Pendente</span>
            <span className="text-gray-500 text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">(aguarda)</span>
          </div>
          <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-blue-200 shadow-sm">
            <div className="relative w-4 h-4 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 border-2 border-blue-600 shadow-sm">
              <div className="absolute -right-1 -top-1 w-2 h-2 bg-red-500 rounded-full border border-white shadow-sm"></div>
            </div>
            <span className="text-gray-800 font-bold">Confirmado</span>
            <span className="text-gray-500 text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">(bloqueia)</span>
          </div>
          {showArchived && (
            <>
              <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-green-200 shadow-sm">
                <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 border-2 border-green-600 shadow-sm flex items-center justify-center">
                  <CheckCircle2 className="h-2.5 w-2.5 text-white" />
                </div>
                <span className="text-gray-800 font-bold">Concluído</span>
              </div>
              <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-red-200 shadow-sm">
                <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-red-400 to-red-500 border-2 border-red-500 shadow-sm flex items-center justify-center">
                  <XCircle className="h-2.5 w-2.5 text-white" />
                </div>
                <span className="text-gray-800 font-bold">Cancelado</span>
              </div>
            </>
          )}
        </div>
        {!showArchived && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-3 flex items-start space-x-3 shadow-sm">
            <div className="h-6 w-6 rounded-lg bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
              <AlertCircle className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-green-900 leading-relaxed">
                <span className="font-bold">Reservas confirmadas</span> bloqueiam horários para outros clientes. <span className="font-bold">Reservas pendentes</span> NÃO bloqueiam e podem ser sobrepostas até serem confirmadas.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">{renderCalendar()}</div>
    </div>
  );
}
