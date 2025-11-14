import { useEffect, useState } from 'react';
import { Users, Scissors, Calendar, TrendingUp, Euro, Activity, Edit, Trash2, X, Clock, Star, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/currency';

interface Stats {
  totalProfessionals: number;
  totalClients: number;
  totalServices: number;
  totalBookings: number;
  totalRevenue: number;
  recentBookings: any[];
}

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  category: string;
  images: string[];
  whatsapp_number: string;
  professional: {
    full_name: string;
    avatar_url: string | null;
  };
  team: Array<{
    id: string;
    profile_id: string;
    name: string;
    imageUrl: string;
  }>;
  reviews: { rating: number }[] | null;
  average_rating: number | null;
}

export function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    totalProfessionals: 0,
    totalClients: 0,
    totalServices: 0,
    totalBookings: 0,
    totalRevenue: 0,
    recentBookings: []
  });
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editConfirm, setEditConfirm] = useState<Service | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [editReason, setEditReason] = useState('');
  const [unreadEmailsCount, setUnreadEmailsCount] = useState(0);

  useEffect(() => {
    loadStats();
    loadServices();
    loadUnreadEmailsCount();
  }, []);

  const loadStats = async () => {
    try {
      const [professionalsRes, clientsRes, servicesRes, bookingsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'professional'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('bookings').select('*, service:services(title, price)', { count: 'exact' }).order('created_at', { ascending: false }).limit(10)
      ]);

      const totalRevenue = bookingsRes.data?.reduce((sum, booking) => sum + (booking.service?.price || 0), 0) || 0;

      setStats({
        totalProfessionals: professionalsRes.count || 0,
        totalClients: clientsRes.count || 0,
        totalServices: servicesRes.count || 0,
        totalBookings: bookingsRes.count || 0,
        totalRevenue,
        recentBookings: bookingsRes.data || []
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadServices = async () => {
    try {
      const { data, error } = await supabase
        .from('services')
        .select(`
          *,
          professional:profiles!services_professional_id_fkey(
            full_name,
            avatar_url
          ),
          reviews:reviews(rating)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const servicesWithRatings = (data || []).map(service => ({
        ...service,
        average_rating: service.reviews && service.reviews.length > 0
          ? service.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / service.reviews.length
          : null
      }));

      setServices(servicesWithRatings);
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const loadUnreadEmailsCount = async () => {
    try {
      const { count, error } = await supabase
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');

      if (error) throw error;
      setUnreadEmailsCount(count || 0);
    } catch (error) {
      console.error('Error loading unread emails count:', error);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!deleteReason.trim() || deleteReason.trim().length < 10) {
      alert('Por favor, forneça uma razão com pelo menos 10 caracteres para eliminar este serviço.');
      return;
    }

    try {
      const service = services.find(s => s.id === serviceId);
      if (!service) return;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      await supabase
        .from('service_modifications_log')
        .insert({
          service_id: serviceId,
          service_title: service.title,
          professional_id: service.professional_id,
          admin_id: user.id,
          action_type: 'deleted',
          reason: deleteReason.trim(),
          changes_made: {
            deleted_service: {
              title: service.title,
              description: service.description,
              price: service.price,
              duration: service.duration,
              category: service.category
            }
          }
        });

      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      setServices(services.filter(s => s.id !== serviceId));
      setDeleteConfirm(null);
      setDeleteReason('');
      loadStats();
      alert('Serviço eliminado e o profissional foi notificado.');
    } catch (error) {
      console.error('Error deleting service:', error);
      alert('Erro ao eliminar serviço');
    }
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
  };

  const handleClosePopup = () => {
    setSelectedService(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Profissionais',
      value: stats.totalProfessionals,
      icon: Users,
      color: 'blue',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Total Clientes',
      value: stats.totalClients,
      icon: Users,
      color: 'green',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    },
    {
      title: 'Total Serviços',
      value: stats.totalServices,
      icon: Scissors,
      color: 'purple',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Total Marcações',
      value: stats.totalBookings,
      icon: Calendar,
      color: 'orange',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600'
    },
    {
      title: 'Receita Total',
      value: formatCurrency(stats.totalRevenue),
      icon: Euro,
      color: 'emerald',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600'
    },
    {
      title: 'Atividade',
      value: 'Em Tempo Real',
      icon: Activity,
      color: 'pink',
      bgColor: 'bg-pink-50',
      iconColor: 'text-pink-600'
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
          <p className="mt-2 text-sm sm:text-base text-gray-600">Visão geral completa da plataforma</p>
        </div>
        <button
          onClick={() => navigate('/super-admin/emails')}
          className="relative flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          <Mail className="h-5 w-5 mr-2" />
          Mensagens
          {unreadEmailsCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
              {unreadEmailsCount}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className={`${card.bgColor} rounded-lg p-6 shadow-sm border border-gray-200`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{card.title}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`${card.bgColor} p-3 rounded-full`}>
                  <Icon className={`h-8 w-8 ${card.iconColor}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Gestão de Serviços</h2>
          <Scissors className="h-5 w-5 text-gray-400" />
        </div>

        {services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service) => (
              <div
                key={service.id}
                className="group relative bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div onClick={() => handleServiceClick(service)} className="cursor-pointer">
                  {service.images && service.images.length > 0 ? (
                    <img
                      src={service.images[0]}
                      alt={service.title}
                      className="w-full h-48 object-cover"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = 'https://via.placeholder.com/400x200?text=Sem+Imagem';
                      }}
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-50 flex flex-col items-center justify-center">
                      <Scissors className="h-12 w-12 text-blue-300 mb-2" />
                      <span className="text-sm text-blue-400">{service.category}</span>
                    </div>
                  )}

                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {service.title}
                        </h3>
                        <span className="text-xs text-gray-500">{service.category}</span>
                      </div>
                      {service.average_rating !== null && (
                        <div className="flex items-center bg-blue-50 px-2 py-1 rounded">
                          <Star className="h-4 w-4 text-blue-600 mr-1" />
                          <span className="text-sm font-medium text-blue-600">
                            {service.average_rating.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 text-gray-600 line-clamp-2 text-sm">{service.description}</p>
                    <div className="mt-4 flex items-center">
                      <img
                        src={service.professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(service.professional.full_name)}&background=random`}
                        alt={service.professional.full_name}
                        className="h-8 w-8 rounded-full object-cover"
                      />
                      <span className="ml-2 text-sm text-gray-600">
                        {service.professional.full_name}
                      </span>
                    </div>
                    <div className="mt-4 flex justify-between items-center">
                      <span className="text-xl font-bold text-blue-600">
                        {formatCurrency(service.price)}
                      </span>
                      <span className="text-sm text-gray-500 flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        {service.duration}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-4 pb-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditConfirm(service);
                      setEditReason('');
                    }}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const serviceToDelete = services.find(s => s.id === service.id);
                      if (serviceToDelete) {
                        setDeleteConfirm(service.id);
                        setDeleteReason('');
                      }
                    }}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Nenhum serviço encontrado</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Marcações Recentes</h2>
          <TrendingUp className="h-5 w-5 text-gray-400" />
        </div>

        {stats.recentBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Serviço
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Preço
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recentBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {booking.service?.title || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(booking.start_time).toLocaleDateString('pt-PT', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })} às {new Date(booking.start_time).toLocaleTimeString('pt-PT', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        booking.status === 'confirmado' ? 'bg-green-100 text-green-800' :
                        booking.status === 'pendente' ? 'bg-yellow-100 text-yellow-800' :
                        booking.status === 'concluído' ? 'bg-blue-100 text-blue-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(booking.service?.price || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-gray-500 py-8">Nenhuma marcação encontrada</p>
        )}
      </div>

      {selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="relative">
              {selectedService.images && selectedService.images.length > 0 && (
                <div className="grid grid-cols-2 gap-2 p-2">
                  {selectedService.images.map((imageUrl, index) => (
                    <img
                      key={index}
                      src={imageUrl}
                      alt={`${selectedService.title} - Imagem ${index + 1}`}
                      className={`${selectedService.images.length === 1 ? 'col-span-2 h-64' : 'h-48'} w-full object-cover rounded-lg`}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = 'https://via.placeholder.com/400x200?text=Sem+Imagem';
                      }}
                    />
                  ))}
                </div>
              )}
              <button
                onClick={handleClosePopup}
                className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
              >
                <X className="h-6 w-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedService.title}</h2>
                  <span className="text-sm text-gray-500">{selectedService.category}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(selectedService.price)}
                  </span>
                  {selectedService.average_rating !== null && (
                    <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-full">
                      <Star className="h-4 w-4 text-yellow-500 mr-1" />
                      <span className="text-sm font-medium text-yellow-700">
                        {selectedService.average_rating.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center text-gray-600">
                <Clock className="h-5 w-5 mr-2 text-blue-600" />
                <span>{selectedService.duration}</span>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Descrição</h3>
                <p className="text-gray-600 whitespace-pre-line">{selectedService.description}</p>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Profissional</h3>
                <div className="flex items-center space-x-3">
                  <img
                    src={selectedService.professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedService.professional.full_name)}&background=random`}
                    alt={selectedService.professional.full_name}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-base font-medium text-gray-900">{selectedService.professional.full_name}</p>
                    <p className="text-sm text-gray-500">Profissional certificado</p>
                  </div>
                </div>
              </div>

              {selectedService.team && selectedService.team.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Equipe</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {selectedService.team.map((member) => (
                      <div key={member.id} className="flex items-center space-x-3">
                        <img
                          src={member.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`}
                          alt={member.name}
                          className="h-12 w-12 rounded-full object-cover"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`;
                          }}
                        />
                        <span className="text-sm font-medium text-gray-900">{member.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {editConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Editar Serviço como Super Admin</h3>
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Atenção:</strong> Está prestes a editar um serviço pertencente a outro profissional.
              </p>
            </div>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Serviço:</strong> {editConfirm.title}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Proprietário:</strong> {editConfirm.professional.full_name}
              </p>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Razão para editar este serviço <span className="text-red-600">*</span>
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explique porque está a editar este serviço... (mínimo 10 caracteres)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {editReason.length} / 10 caracteres mínimos
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setEditConfirm(null);
                  setEditReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (!editReason.trim() || editReason.trim().length < 10) {
                    alert('Por favor, forneça uma razão com pelo menos 10 caracteres.');
                    return;
                  }
                  sessionStorage.setItem('superAdminEditReason', editReason.trim());
                  sessionStorage.setItem('superAdminEditingServiceId', editConfirm.id);
                  window.location.href = `/professional/services/${editConfirm.id}/edit`;
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Prosseguir para Editar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirmar Eliminação</h3>
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">
                <strong>Atenção:</strong> Está prestes a eliminar um serviço permanentemente.
              </p>
            </div>
            {(() => {
              const service = services.find(s => s.id === deleteConfirm);
              return service ? (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Serviço:</strong> {service.title}
                  </p>
                  <p className="text-sm text-gray-600 mb-2">
                    <strong>Proprietário:</strong> {service.professional.full_name}
                  </p>
                </div>
              ) : null;
            })()}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Razão para eliminar este serviço <span className="text-red-600">*</span>
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Explique porque está a eliminar este serviço... (mínimo 10 caracteres)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                rows={4}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {deleteReason.length} / 10 caracteres mínimos
              </p>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              O proprietário será notificado desta ação. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeleteConfirm(null);
                  setDeleteReason('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteService(deleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
