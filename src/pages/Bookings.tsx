import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { format } from 'date-fns';
import { ptLocale } from '../i18n';
import { Calendar, Clock, Check, X, AlertCircle, Filter, Star, Edit2, Trash2, BarChart3, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/currency';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookingEditModal } from '../components/BookingEditModal';
import { BookingCancelModal } from '../components/BookingCancelModal';
import { ReviewEditModal } from '../components/ReviewEditModal';
import { confirmBookingWithCapacityCheck } from '../utils/availability';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: 'pendente' | 'confirmado' | 'concluído' | 'cancelado';
  professional_id: string;
  team_member_id?: string | null;
  is_archived?: boolean;
  cancellation_reason?: string;
  service: {
    id: string;
    title: string;
    price: number;
    category: string;
  };
  service_variant?: {
    id: string;
    name: string;
    price: number;
    duration: string;
  } | null;
  professional: {
    full_name: string;
  } | null;
  team_member?: {
    name: string;
  } | null;
  client: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  has_review?: boolean;
  review?: {
    id: string;
    rating: number;
    comment: string;
    created_at: string;
    original_created_at?: string;
  } | null;
}

export function Bookings() {
  const { t } = useTranslation();
  const { profile } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pendente' | 'confirmado' | 'concluído' | 'cancelado'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState<Booking | null>(null);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<Booking | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedBookingForCancel, setSelectedBookingForCancel] = useState<Booking | null>(null);
  const [showReviewEditModal, setShowReviewEditModal] = useState(false);
  const [selectedReviewForEdit, setSelectedReviewForEdit] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled' | 'all'>('all');
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0, totalSpent: 0 });
  const [highlightedBookingId, setHighlightedBookingId] = useState<string | null>(null);
  const bookingRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  useEffect(() => {
    fetchBookings();
  }, [profile]);

  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && bookings.length > 0) {
      setHighlightedBookingId(highlightId);

      setTimeout(() => {
        const element = bookingRefs.current[highlightId];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });

          setTimeout(() => {
            setHighlightedBookingId(null);
            setSearchParams({});
          }, 3000);
        } else {
          setError('Reserva não encontrada');
          setTimeout(() => setError(''), 3000);
          setSearchParams({});
        }
      }, 100);
    }
  }, [searchParams, bookings, setSearchParams]);

  useEffect(() => {
    let filtered = bookings.filter(b => !b.is_archived);

    if (activeTab === 'upcoming') {
      filtered = filtered.filter(b => b.status === 'pendente' || b.status === 'confirmado');
    } else if (activeTab === 'completed') {
      filtered = filtered.filter(b => b.status === 'concluído');
    } else if (activeTab === 'cancelled') {
      filtered = filtered.filter(b => b.status === 'cancelado');
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }

    setFilteredBookings(filtered);
  }, [bookings, statusFilter, activeTab]);

  useEffect(() => {
    const total = bookings.length;
    const pending = bookings.filter(b => b.status === 'pendente').length;
    const confirmed = bookings.filter(b => b.status === 'confirmado').length;
    const completed = bookings.filter(b => b.status === 'concluído').length;
    const cancelled = bookings.filter(b => b.status === 'cancelado').length;
    const totalSpent = bookings
      .filter(b => b.status === 'concluído')
      .reduce((sum, b) => sum + (b.service_variant?.price || b.service.price), 0);

    setStats({ total, pending, confirmed, completed, cancelled, totalSpent });
  }, [bookings]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: A conexão com a base de dados demorou muito tempo')), 10000)
      );

      const query = profile?.role === 'professional'
        ? supabase
            .from('bookings')
            .select(`
              *,
              service:services(id, title, price, category),
              service_variant:service_variants(id, name, price, duration),
              professional:profiles!bookings_professional_id_fkey(full_name),
              team_member:service_team_members!bookings_team_member_id_fkey(name),
              client:profiles!bookings_client_id_fkey(full_name, avatar_url)
            `)
            .eq('professional_id', profile.id)
            .eq('is_archived', false)
            .order('start_time', { ascending: false })
            .limit(50)
        : supabase
            .from('bookings')
            .select(`
              *,
              service:services(id, title, price, category),
              service_variant:service_variants(id, name, price, duration),
              professional:profiles!bookings_professional_id_fkey(full_name),
              team_member:service_team_members!bookings_team_member_id_fkey(name),
              client:profiles!bookings_client_id_fkey(full_name, avatar_url)
            `)
            .eq('client_id', profile.id)
            .eq('is_archived', false)
            .order('start_time', { ascending: false })
            .limit(50);

      const { data, error } = await Promise.race([query, timeoutPromise]) as any;
      if (error) throw error;

      const validBookings = (data || []).filter((booking: any) => {
        const hasValidService = booking.service && booking.service.title;
        const hasValidProfessional = profile?.role === 'client' ? booking.professional : true;
        const hasValidClient = profile?.role === 'professional' ? booking.client : true;

        if (!hasValidService || !hasValidProfessional || !hasValidClient) {
          console.warn('Booking with missing data found:', {
            id: booking.id,
            hasService: hasValidService,
            hasProfessional: !!booking.professional,
            hasClient: !!booking.client
          });
          return false;
        }
        return true;
      });

      if (profile?.role === 'client' && validBookings.length > 0) {
        const bookingsWithReviews = await Promise.all(
          validBookings.map(async (booking) => {
            const { data: review } = await supabase
              .from('reviews')
              .select('id, rating, comment, created_at, original_created_at')
              .eq('booking_id', booking.id)
              .maybeSingle();

            return {
              ...booking,
              has_review: !!review,
              review: review || null
            };
          })
        );
        setBookings(bookingsWithReviews);
      } else {
        setBookings(validBookings);
      }
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      if (error.message && error.message.includes('Timeout')) {
        setError('A conexão com a base de dados está lenta. Por favor, tente novamente.');
      } else {
        setError(t('bookings.error.fetchBookings'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: Booking['status']) => {
    try {
      if (newStatus === 'confirmado') {
        const result = await confirmBookingWithCapacityCheck(bookingId);

        if (!result.success) {
          setError(result.message);
          setTimeout(() => setError(''), 5000);
          return;
        }

        if (result.assignedTo) {
          setSuccess(`Reserva confirmada! Atribuído a: ${result.assignedTo}`);
        } else {
          setSuccess(result.message || 'Reserva confirmada com sucesso!');
        }
      } else {
        const { error } = await supabase
          .from('bookings')
          .update({ status: newStatus })
          .eq('id', bookingId);

        if (error) throw error;

        setSuccess(t('bookings.success.statusUpdate'));
      }

      setTimeout(() => setSuccess(''), 3000);
      fetchBookings();
    } catch (err) {
      console.error('Error updating booking:', err);
      setError(t('bookings.error.updateStatus'));
    }
  };

  const handleArchiveBooking = async (bookingId: string) => {
    if (!confirm('Tem a certeza que deseja eliminar permanentemente esta reserva? Esta ação não pode ser revertida.')) {
      return;
    }

    try {
      console.log('Tentando eliminar reserva:', bookingId);
      const { data, error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) {
        console.error('Erro detalhado ao eliminar:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Reserva eliminada com sucesso:', data);
      setSuccess('Reserva eliminada com sucesso');
      setTimeout(() => setSuccess(''), 3000);
      fetchBookings();
    } catch (err: any) {
      console.error('Error deleting booking:', err);
      const errorMessage = err?.message || 'Erro desconhecido ao eliminar reserva';
      setError(`Erro ao eliminar: ${errorMessage}`);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Tem a certeza que deseja eliminar permanentemente esta reserva? Esta ação não pode ser revertida.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) throw error;

      setSuccess('Reserva eliminada com sucesso');
      setTimeout(() => setSuccess(''), 3000);
      fetchBookings();
    } catch (err) {
      console.error('Error deleting booking:', err);
      setError('Erro ao eliminar reserva');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getStatusColor = (status: Booking['status']) => {
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
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        {profile?.role === 'client' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-gray-100 rounded-xl p-6 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
                  <div className="h-8 bg-gray-300 rounded w-16"></div>
                </div>
              ))}
            </div>
            <div className="flex space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded-lg w-32 animate-pulse"></div>
              ))}
            </div>
          </>
        )}
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card-gradient p-6 animate-pulse">
              <div className="space-y-4">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                </div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{t('bookings.title')}</h1>
        {profile?.role === 'professional' && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-5 w-5 mr-2" />
            Filtros
          </button>
        )}
      </div>

      {profile?.role === 'client' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total de Reservas</p>
                  <p className="text-3xl font-bold mt-2">{stats.total}</p>
                </div>
                <BarChart3 className="h-12 w-12 text-blue-200" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Completadas</p>
                  <p className="text-3xl font-bold mt-2">{stats.completed}</p>
                </div>
                <Check className="h-12 w-12 text-green-200" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Total Gasto</p>
                  <p className="text-3xl font-bold mt-2">{formatCurrency(stats.totalSpent)}</p>
                </div>
                <TrendingUp className="h-12 w-12 text-purple-200" />
              </div>
            </div>
          </div>

          <div className="flex space-x-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300'
              }`}
            >
              Todas <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/20">{bookings.filter(b => !b.is_archived).length}</span>
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                activeTab === 'upcoming'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-blue-300'
              }`}
            >
              Próximas <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/20">{stats.pending + stats.confirmed}</span>
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                activeTab === 'completed'
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-green-300'
              }`}
            >
              Concluídas <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/20">{stats.completed}</span>
            </button>
            <button
              onClick={() => setActiveTab('cancelled')}
              className={`px-6 py-3 rounded-lg font-semibold whitespace-nowrap transition-all ${
                activeTab === 'cancelled'
                  ? 'bg-red-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 border-2 border-gray-200 hover:border-red-300'
              }`}
            >
              Canceladas <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-white/20">{stats.cancelled}</span>
            </button>
          </div>
        </>
      )}

      {showFilters && profile?.role === 'professional' && (
        <div className="card-gradient p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Filtrar por Status</h3>
          <div className="flex flex-wrap gap-2">
            {(['all', 'pendente', 'confirmado', 'concluído', 'cancelado'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status === 'all' ? 'Todas' : t(`bookings.status.${status}`)}
                {status !== 'all' && (
                  <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {bookings.filter(b => b.status === status).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4 border border-red-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
            {error.includes('lenta') && (
              <button
                onClick={() => {
                  setError('');
                  fetchBookings();
                }}
                className="px-3 py-1 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
              >
                Tentar novamente
              </button>
            )}
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      <div className="grid gap-6">
        {filteredBookings.map((booking) => (
          <div
            key={booking.id}
            ref={(el) => { bookingRefs.current[booking.id] = el; }}
            className={`card-gradient p-6 transition-all duration-500 ${
              highlightedBookingId === booking.id
                ? 'ring-4 ring-blue-500 ring-opacity-50 shadow-2xl scale-[1.02]'
                : ''
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {booking.service.title}
                  </h3>
                  <span className="text-sm text-gray-500">
                    ({booking.service.category})
                  </span>
                </div>
                {booking.service_variant && (
                  <div className="mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {booking.service_variant.name}
                  </div>
                )}
                <p className="text-gray-600 mt-1">
                  {profile?.role === 'professional'
                    ? `${t('dashboard.professional.recentBookings.columns.client')}: ${booking.client?.full_name || 'Cliente indisponível'}`
                    : `${t('dashboard.professional.recentBookings.columns.service')}: ${booking.professional?.full_name || 'Profissional indisponível'}`}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(booking.status)}`}>
                  {t(`bookings.status.${booking.status}`)}
                </span>
                {profile?.role === 'professional' && booking.status === 'pendente' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'confirmado')}
                      className="p-1 rounded-full bg-green-100 text-green-600 hover:bg-green-200"
                      title={t('bookings.actions.confirm')}
                    >
                      <Check className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(booking.id, 'cancelado')}
                      className="p-1 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                      title={t('bookings.actions.cancel')}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                )}
                {profile?.role === 'professional' && booking.status === 'confirmado' && (
                  <button
                    onClick={() => handleStatusUpdate(booking.id, 'concluído')}
                    className="p-1 rounded-full bg-green-100 text-green-600 hover:bg-green-200"
                    title={t('bookings.actions.complete')}
                  >
                    <Check className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="flex items-center text-gray-600">
                <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                <span>{format(new Date(booking.start_time), 'PPP', { locale: ptLocale })}</span>
              </div>
              <div className="flex items-center text-gray-600">
                <Clock className="h-5 w-5 mr-2 text-blue-600" />
                <span>
                  {format(new Date(booking.start_time), 'p', { locale: ptLocale })} - {format(new Date(booking.end_time), 'p', { locale: ptLocale })}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-between items-center">
              <div>
                <span className="text-lg font-bold text-blue-600">
                  {booking.service_variant ? formatCurrency(booking.service_variant.price) : formatCurrency(booking.service.price)}
                </span>
                {booking.service_variant && (
                  <span className="ml-2 text-sm text-gray-500">
                    ({booking.service_variant.duration})
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {profile?.role === 'client' && (booking.status === 'pendente' || booking.status === 'confirmado') && (
                  <>
                    <button
                      onClick={() => {
                        setSelectedBookingForEdit(booking);
                        setShowEditModal(true);
                      }}
                      className="inline-flex items-center px-3 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-all shadow-md text-sm"
                    >
                      <Edit2 className="h-4 w-4 mr-1.5" />
                      Editar
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBookingForCancel(booking);
                        setShowCancelModal(true);
                      }}
                      className="inline-flex items-center px-3 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-all shadow-md text-sm"
                    >
                      <X className="h-4 w-4 mr-1.5" />
                      Cancelar
                    </button>
                  </>
                )}
                {profile?.role === 'client' && booking.status === 'cancelado' && (
                  <>
                    <button
                      onClick={() => handleArchiveBooking(booking.id)}
                      className="inline-flex items-center px-3 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-all shadow-md text-sm"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Eliminar
                    </button>
                  </>
                )}
                {profile?.role === 'client' && booking.status === 'concluído' && !booking.has_review && (
                  <button
                    onClick={() => {
                      setSelectedBookingForReview(booking);
                      setShowReviewModal(true);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Avaliar Serviço
                  </button>
                )}
                {profile?.role === 'client' && booking.status === 'concluído' && booking.has_review && (
                  <>
                    <button
                      onClick={() => {
                        if (booking.review && booking.professional) {
                          setSelectedReviewForEdit({
                            ...booking.review,
                            service: booking.service,
                            professional: booking.professional
                          });
                          setShowReviewEditModal(true);
                        }
                      }}
                      disabled={!booking.professional}
                      className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar Avaliação
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {filteredBookings.length === 0 && bookings.length > 0 && (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500 text-lg">Nenhuma reserva encontrada com este filtro</p>
          </div>
        )}

        {bookings.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-500 text-lg">{t('bookings.noBookings.title')}</p>
            <p className="text-gray-400">
              {profile?.role === 'client'
                ? t('bookings.noBookings.client')
                : t('bookings.noBookings.professional')}
            </p>
          </div>
        )}
      </div>

      {showReviewModal && selectedBookingForReview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Avaliar Serviço</h2>
              <p className="text-yellow-100 text-sm mt-1">{selectedBookingForReview.service.title}</p>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Classificação
                </label>
                <div className="flex justify-center space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewReview({ ...newReview, rating: star })}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-10 w-10 ${
                          star <= newReview.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Comentário
                </label>
                <textarea
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  rows={5}
                  placeholder="Partilhe a sua experiência com este serviço..."
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 transition-all px-4 py-3 text-gray-900 placeholder-gray-400 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setSelectedBookingForReview(null);
                    setNewReview({ rating: 5, comment: '' });
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (!newReview.comment.trim()) {
                        setError('Por favor, escreva um comentário');
                        return;
                      }

                      const { error: reviewError } = await supabase
                        .from('reviews')
                        .insert({
                          booking_id: selectedBookingForReview.id,
                          client_id: profile?.id,
                          service_id: selectedBookingForReview.service.id,
                          professional_id: selectedBookingForReview.professional_id,
                          rating: newReview.rating,
                          comment: newReview.comment
                        });

                      if (reviewError) throw reviewError;

                      setSuccess('Avaliação enviada com sucesso!');
                      setShowReviewModal(false);
                      setSelectedBookingForReview(null);
                      setNewReview({ rating: 5, comment: '' });
                      fetchBookings();
                    } catch (err: any) {
                      console.error('Error submitting review:', err);
                      setError(err.message || 'Erro ao enviar avaliação');
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg shadow-yellow-500/30 inline-flex items-center justify-center"
                >
                  <Star className="h-5 w-5 mr-2" />
                  Enviar Avaliação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedBookingForEdit && (
        <BookingEditModal
          booking={selectedBookingForEdit}
          onClose={() => {
            setShowEditModal(false);
            setSelectedBookingForEdit(null);
          }}
          onSuccess={() => {
            setSuccess('Reserva atualizada com sucesso!');
            setTimeout(() => setSuccess(''), 3000);
            fetchBookings();
          }}
        />
      )}

      {showCancelModal && selectedBookingForCancel && (
        <BookingCancelModal
          booking={selectedBookingForCancel}
          onClose={() => {
            setShowCancelModal(false);
            setSelectedBookingForCancel(null);
          }}
          onSuccess={() => {
            setSuccess('Reserva cancelada com sucesso!');
            setTimeout(() => setSuccess(''), 3000);
            fetchBookings();
          }}
        />
      )}

      {showReviewEditModal && selectedReviewForEdit && (
        <ReviewEditModal
          review={selectedReviewForEdit}
          onClose={() => {
            setShowReviewEditModal(false);
            setSelectedReviewForEdit(null);
          }}
          onSuccess={() => {
            setSuccess('Avaliação atualizada com sucesso!');
            setTimeout(() => setSuccess(''), 3000);
            fetchBookings();
          }}
        />
      )}
    </div>
  );
}