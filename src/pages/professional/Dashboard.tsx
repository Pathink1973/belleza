import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Scissors,
  Star,
  TrendingUp,
  Activity,
  Users,
  Plus,
  Bell,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { ptLocale } from '../../i18n';
import { formatCurrency } from '../../utils/currency';
import { useNotifications } from '../../hooks/useNotifications';
import { RealtimeAvailabilityBadge } from '../../components/RealtimeAvailabilityBadge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

interface Stats {
  totalBookings: number;
  totalClients: number;
  totalRevenue: number;
  averageRating: number;
}

interface ChartData {
  date: string;
  bookings: number;
  revenue: number;
}

export function ProfessionalDashboard() {
  const { t, i18n } = useTranslation();
  const { user } = useAuthStore();
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const [stats, setStats] = useState<Stats>({
    totalBookings: 0,
    totalClients: 0,
    totalRevenue: 0,
    averageRating: 0,
  });
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceModifications, setServiceModifications] = useState<any[]>([]);
  const [modificationsCount, setModificationsCount] = useState(0);
  const [myServices, setMyServices] = useState<any[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        if (!user?.id) return;

        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select(`
            id,
            start_time,
            status,
            client_id,
            service:services (
              id,
              title,
              price
            ),
            client:profiles!bookings_client_id_fkey (
              id,
              full_name
            )
          `)
          .eq('professional_id', user.id)
          .eq('is_archived', false)
          .order('start_time', { ascending: false });

        if (bookingsError) throw bookingsError;

        const bookings = bookingsData || [];

        const totalBookings = bookings.length;

        const uniqueClients = new Set(bookings.map(b => b.client_id).filter(Boolean));
        const totalClients = uniqueClients.size;

        const totalRevenue = bookings
          .filter(b => b.status === 'concluído' && b.service)
          .reduce((sum, b) => sum + (b.service?.price || 0), 0);

        const recentBookings = bookings.slice(0, 5);

        setStats({
          totalBookings,
          totalClients,
          totalRevenue,
          averageRating: 0,
        });
        setRecentBookings(recentBookings);

        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - i);
          return format(date, 'yyyy-MM-dd');
        }).reverse();

        const chartData = last7Days.map(dateStr => {
          const dayBookings = bookings.filter(b => {
            const bookingDate = format(new Date(b.start_time), 'yyyy-MM-dd');
            return bookingDate === dateStr;
          });

          const dayRevenue = dayBookings
            .filter(b => b.status === 'concluído' && b.service)
            .reduce((sum, b) => sum + (b.service?.price || 0), 0);

          return {
            date: format(new Date(dateStr), 'MMM dd', { locale: ptLocale }),
            bookings: dayBookings.length,
            revenue: dayRevenue
          };
        });

        setChartData(chartData);

        const { data: modificationsData, error: modificationsError } = await supabase
          .from('service_modifications_log')
          .select(`
            *,
            admin:profiles!service_modifications_log_admin_id_fkey(
              full_name,
              avatar_url
            )
          `)
          .eq('professional_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (!modificationsError && modificationsData) {
          setServiceModifications(modificationsData);
          setModificationsCount(modificationsData.length);
        }

        // Buscar serviços do profissional para badges de disponibilidade
        const { data: servicesData } = await supabase
          .from('services')
          .select('id, title')
          .eq('professional_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (servicesData) {
          setMyServices(servicesData);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchDashboardData();
    }
  }, [user?.id, i18n.language]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">
          {t('dashboard.professional.title')}
        </h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto">
          <Link
            to="/professional/bookings/new"
            className="px-4 py-2 bg-white border-2 border-blue-600 text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors inline-flex items-center"
          >
            <Calendar className="h-5 w-5 mr-2" />
            Criar Reserva
          </Link>
          <Link
            to="/professional/services/new"
            className="btn-gradient inline-flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('dashboard.professional.addService')}
          </Link>
        </div>
      </div>

      {/* Disponibilidade em Tempo Real */}
      {myServices.length > 0 && (
        <div className="card-gradient p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-blue-600" />
            Disponibilidade dos Seus Serviços Hoje
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {myServices.map((service) => (
              <div key={service.id} className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">{service.title}</h3>
                <RealtimeAvailabilityBadge
                  serviceId={service.id}
                  date={new Date()}
                  compact={false}
                  showStats={true}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notifications Panel */}
      {unreadCount > 0 && (
        <div className="card-gradient p-6 border-l-4 border-blue-600">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {unreadCount === 1 ? 'Nova Notificação' : `${unreadCount} Novas Notificações`}
                </h3>
                <p className="text-sm text-gray-600">
                  Você tem {unreadCount === 1 ? 'uma notificação não lida' : `${unreadCount} notificações não lidas`}
                </p>
              </div>
            </div>
            <Link
              to="/notifications"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Ver todas
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {notifications.filter(n => !n.read).slice(0, 3).map((notification) => (
              <div
                key={notification.id}
                className="bg-white rounded-lg p-4 border border-blue-100 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">{notification.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: ptLocale
                        })}
                      </span>
                      {notification.booking_id && (
                        <Link
                          to="/bookings"
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Ver reserva →
                        </Link>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => markAsRead([notification.id])}
                    className="ml-3 p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Marcar como lida"
                  >
                    <CheckCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service Modifications Alert */}
      {modificationsCount > 0 && (
        <div className="card-gradient p-6 border-l-4 border-orange-600">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {modificationsCount === 1 ? 'Modificação do Super Admin' : `${modificationsCount} Modificações do Super Admin`}
                </h3>
                <p className="text-sm text-gray-600">
                  O Super Admin {modificationsCount === 1 ? 'fez alterações a um dos seus serviços' : 'fez alterações aos seus serviços'}
                </p>
              </div>
            </div>
            <Link
              to="/professional/service-modifications"
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              Ver Histórico Completo
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {serviceModifications.slice(0, 3).map((modification) => (
              <div
                key={modification.id}
                className="bg-white rounded-lg p-4 border border-orange-100 hover:border-orange-300 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={
                        modification.action_type === 'edited'
                          ? 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800'
                          : 'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800'
                      }>
                        {modification.action_type === 'edited' ? 'Editado' : 'Eliminado'}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{modification.service_title}</span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Razão:</strong> {modification.reason.length > 100 ? modification.reason.substring(0, 100) + '...' : modification.reason}
                    </p>
                    <div className="flex items-center space-x-3 mt-2">
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatDistanceToNow(new Date(modification.created_at), {
                          addSuffix: true,
                          locale: ptLocale
                        })}
                      </span>
                      <span className="text-xs text-gray-500">
                        Por: {modification.admin.full_name}
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/professional/service-modifications"
                    className="ml-3 p-1 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                    title="Ver detalhes"
                  >
                    <FileText className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        <div className="card-gradient p-6">
          <div className="flex items-center">
            <Calendar className="h-10 w-10 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                {t('dashboard.professional.stats.totalBookings')}
              </p>
              <h3 className="text-2xl font-bold text-gray-900">
                {stats.totalBookings}
              </h3>
            </div>
          </div>
        </div>

        <div className="card-gradient p-6">
          <div className="flex items-center">
            <Users className="h-10 w-10 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                {t('dashboard.professional.stats.totalClients')}
              </p>
              <h3 className="text-2xl font-bold text-gray-900">
                {stats.totalClients}
              </h3>
            </div>
          </div>
        </div>

        <div className="card-gradient p-6">
          <div className="flex items-center">
            <TrendingUp className="h-10 w-10 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                {t('dashboard.professional.stats.totalRevenue')}
              </p>
              <h3 className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats.totalRevenue)}
              </h3>
            </div>
          </div>
        </div>

        <div className="card-gradient p-6">
          <div className="flex items-center">
            <Star className="h-10 w-10 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">
                {t('dashboard.professional.stats.averageRating')}
              </p>
              <h3 className="text-2xl font-bold text-gray-900">
                {stats.averageRating} / 5
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="card-gradient p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">
            {t('dashboard.professional.charts.bookingsOverview')}
          </h2>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="bookings" fill="#9333ea" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card-gradient p-6">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">
            {t('dashboard.professional.charts.revenueTrend')}
          </h2>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#4f46e5"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Bookings */}
      <div className="card-gradient p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Marcações Recentes
        </h2>
        {recentBookings.length === 0 ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Nenhuma marcação encontrada
            </h3>
            <p className="mt-2 text-gray-500">
              Suas marcações aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                    {t('bookings.info.client')}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Serviço
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-blue-900 uppercase tracking-wider">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-blue-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-md">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-semibold text-gray-900">
                            {booking.client?.full_name || t('auth.client')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {booking.service?.title || 'Serviço'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-700">
                        {format(new Date(booking.start_time), 'PPp', {
                          locale: i18n.language === 'pt' ? ptLocale : undefined
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full shadow-sm
                        ${booking.status === 'concluído' ? 'bg-green-100 text-green-800' :
                          booking.status === 'cancelado' ? 'bg-red-100 text-red-800' :
                          booking.status === 'confirmado' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'}`}>
                        {booking.status === 'concluído' ? 'Concluído' :
                         booking.status === 'cancelado' ? 'Cancelado' :
                         booking.status === 'confirmado' ? 'Confirmado' :
                         'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-gray-900">
                        {formatCurrency(booking.service?.price || 0)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Link
          to="/professional/bookings/new"
          className="card-gradient p-6 hover:scale-105 transition-transform group border-2 border-blue-200"
        >
          <div className="flex items-center justify-center h-12 w-12 rounded-lg bg-blue-100 mb-3 group-hover:bg-blue-200 transition-colors">
            <Plus className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
            Criar Reserva
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Agendar para clientes existentes ou novos
          </p>
        </Link>

        <Link
          to="/professional/calendar"
          className="card-gradient p-6 hover:scale-105 transition-transform group"
        >
          <Calendar className="h-8 w-8 text-blue-600 mb-3 group-hover:text-blue-700" />
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
            Calendário
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Gerencie suas marcações e horários
          </p>
        </Link>

        <Link 
          to="/professional/services" 
          className="card-gradient p-6 hover:scale-105 transition-transform group"
        >
          <Scissors className="h-8 w-8 text-blue-600 mb-3 group-hover:text-blue-700" />
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
            Serviços
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Gerencie sua lista de serviços
          </p>
        </Link>

        <Link
          to="/professional/clients"
          className="card-gradient p-6 hover:scale-105 transition-transform group"
        >
          <Users className="h-8 w-8 text-blue-600 mb-3 group-hover:text-blue-700" />
          <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600">
            {t('navigation.clients')}
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            Visualize e gerencie seus clientes
          </p>
        </Link>
      </div>
    </div>
  );
}