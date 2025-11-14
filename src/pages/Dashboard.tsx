import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  Scissors,
  Star,
  Clock,
  MapPin,
  Search,
  MessageCircle,
  X,
  User,
  Phone
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/currency';
import { GlowCard } from '../components/ui/spotlight-card';
import { handleWhatsAppClick as handleWhatsAppUtil } from '../utils/whatsapp';

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  images: string[];
  whatsapp_number: string;
  category: string;
  team: Array<{
    id: string;
    profile_id: string;
    name: string;
    imageUrl: string;
  }>;
  professional: {
    full_name: string;
    avatar_url: string | null;
    business_name: string | null;
    business_description: string | null;
    business_address: string | null;
    business_phone: string | null;
  };
  average_rating: number | null;
}

interface Category {
  icon: React.ReactNode;
  name: string;
  description: string;
  query: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [featuredServices, setFeaturedServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const categories: Category[] = [
    {
      icon: <Scissors className="h-8 w-8 text-blue-600" />,
      name: 'Cabelo e penteado',
      description: 'Cortes, penteados e tratamentos',
      query: 'Cabelo e penteado'
    },
    {
      icon: <Star className="h-8 w-8 text-blue-600" />,
      name: 'Unhas',
      description: 'Manicure e pedicure',
      query: 'Unhas'
    },
    {
      icon: <Clock className="h-8 w-8 text-blue-600" />,
      name: 'Sobrancelhas',
      description: 'Design e tratamentos',
      query: 'Sobrancelhas'
    },
    {
      icon: <MessageCircle className="h-8 w-8 text-blue-600" />,
      name: 'Massagem',
      description: 'Relaxamento e terapêutica',
      query: 'Massagem'
    },
    {
      icon: <Scissors className="h-8 w-8 text-blue-600" />,
      name: 'Barbearia',
      description: 'Barba e cabelo masculino',
      query: 'Barbearia'
    },
    {
      icon: <Star className="h-8 w-8 text-blue-600" />,
      name: 'Depilação',
      description: 'Diversos métodos',
      query: 'Depilação'
    },
    {
      icon: <Star className="h-8 w-8 text-blue-600" />,
      name: 'Tratamento Facial',
      description: 'Limpeza e rejuvenescimento',
      query: 'Tratamento Facial'
    },
    {
      icon: <Star className="h-8 w-8 text-blue-600" />,
      name: 'Tratamento Corporal',
      description: 'Estética e bem-estar',
      query: 'Tratamento Corporal'
    },
    {
      icon: <Star className="h-8 w-8 text-blue-600" />,
      name: 'Injectáveis',
      description: 'Procedimentos estéticos',
      query: 'Injectáveis'
    },
    {
      icon: <Star className="h-8 w-8 text-blue-600" />,
      name: 'Tatuagem e piercing',
      description: 'Arte corporal',
      query: 'Tatuagem e piercing'
    },
    {
      icon: <MapPin className="h-8 w-8 text-blue-600" />,
      name: 'Maquilhagem',
      description: 'Maquiagem profissional',
      query: 'Maquilhagem'
    },
    {
      icon: <User className="h-8 w-8 text-blue-600" />,
      name: 'Fitness',
      description: 'Treino e bem-estar físico',
      query: 'Fitness'
    }
  ];

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const { data: featured } = await supabase
          .from('services')
          .select(`
            *,
            professional:profiles!services_professional_id_fkey(
              full_name,
              avatar_url,
              business_name,
              business_description,
              business_address,
              business_phone
            ),
            reviews(rating)
          `)
          .order('created_at', { ascending: false })
          .limit(3);

        if (featured) {
          const featuredWithRating = featured.map(service => ({
            ...service,
            average_rating: service.reviews && service.reviews.length > 0
              ? service.reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / service.reviews.length
              : null
          }));
          setFeaturedServices(featuredWithRating);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
  };

  const handleClosePopup = () => {
    setSelectedService(null);
  };

  const handleWhatsAppClick = (service: Service) => {
    const businessDisplayName = service.professional.business_name || service.professional.full_name;

    handleWhatsAppUtil(service.whatsapp_number, {
      serviceTitle: service.title,
      servicePrice: service.price,
      serviceDuration: service.duration,
      businessName: businessDisplayName
    });
  };

  const ServiceDetailsPopup = ({ service }: { service: Service }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="relative">
          {service.images && service.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-2">
              {service.images.map((imageUrl, index) => (
                <img
                  key={index}
                  src={imageUrl}
                  alt={`${service.title} - Imagem ${index + 1}`}
                  className={`${service.images.length === 1 ? 'col-span-2 h-64' : 'h-48'} w-full object-cover rounded-lg`}
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
              <h2 className="text-2xl font-bold text-gray-900">{service.title}</h2>
              <span className="text-sm text-gray-500">{service.category}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-2xl font-bold text-blue-600">
                {formatCurrency(service.price)}
              </span>
              {service.average_rating !== null && (
                <div className="flex items-center bg-yellow-50 px-2 py-1 rounded-full">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="text-sm font-medium text-yellow-700">
                    {service.average_rating.toFixed(1)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center text-gray-600">
            <Clock className="h-5 w-5 mr-2 text-blue-600" />
            <span>{service.duration}</span>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Descrição</h3>
            <p className="text-gray-600 whitespace-pre-line">{service.description}</p>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Estabelecimento</h3>
            <div className="flex items-start space-x-3 mb-4">
              <img
                src={service.professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(service.professional.business_name || service.professional.full_name)}&background=random`}
                alt={service.professional.business_name || service.professional.full_name}
                className="h-12 w-12 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">{service.professional.business_name || service.professional.full_name}</p>
                <p className="text-sm text-gray-500">{service.professional.business_description || 'Profissional certificado'}</p>
              </div>
            </div>
            {(service.professional.business_address || service.professional.business_phone) && (
              <div className="space-y-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                {service.professional.business_address && (
                  <div className="flex items-start">
                    <MapPin className="h-4 w-4 mr-2 mt-0.5 text-blue-600 flex-shrink-0" />
                    <span>{service.professional.business_address}</span>
                  </div>
                )}
                {service.professional.business_phone && (
                  <div className="flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-blue-600 flex-shrink-0" />
                    <a
                      href={`tel:${service.professional.business_phone}`}
                      className="hover:text-blue-600 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {service.professional.business_phone}
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {service.team && service.team.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Equipe</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {service.team.map((member) => (
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

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => handleWhatsAppClick(service)}
              className="btn-whatsapp inline-flex items-center"
            >
              <MessageCircle className="h-5 w-5 mr-2" />
              Contactar via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/services?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(e);
    }
  };

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="text-center space-y-8 py-8">
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-700 bg-clip-text text-transparent leading-tight">
            Encontre o Serviço Perfeito
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed text-center">
            Marque serviços de beleza com profissionais de topo
          </p>
        </div>
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSearch} className="relative group">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pesquisar serviços ou profissionais..."
              className="w-full pl-14 pr-16 py-4 text-lg rounded-2xl border-2 border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-lg hover:shadow-xl transition-all duration-300"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition-colors duration-200 font-medium shadow-md"
            >
              Buscar
            </button>
          </form>
        </div>
      </div>

      {/* Categories Section */}
      <div className="py-8">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Navegar por Categoria</h2>
          <p className="text-gray-600 text-lg">Escolha a categoria que melhor se adequa às suas necessidades</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {categories.map((category, index) => (
            <Link
              key={index}
              to={`/services?category=${category.query}`}
              className="block h-full"
            >
              <div className="group h-full">
                <GlowCard
                  glowColor={index % 3 === 0 ? 'blue' : index % 3 === 1 ? 'green' : 'cyan'}
                  customSize={true}
                  className="w-full h-full min-h-[200px] !p-8 hover:scale-105 transition-all duration-300 cursor-pointer"
                >
                  <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                    <div className="flex-shrink-0 flex justify-center p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                      {category.icon}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">{category.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{category.description}</p>
                  </div>
                </GlowCard>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Featured Services Section */}
      {!loading && featuredServices.length > 0 && (
        <div className="py-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Serviços em Destaque</h2>
            <p className="text-gray-600 text-lg mb-6">Descubra os serviços mais populares e bem avaliados</p>
            <Link
              to="/services"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors duration-200 shadow-lg hover:shadow-xl"
            >
              Ver Todos os Serviços
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredServices.map((service) => (
              <div
                key={service.id}
                onClick={() => handleServiceClick(service)}
                className="group bg-white rounded-2xl overflow-hidden hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-blue-200 transform hover:-translate-y-1"
              >
                <div className="relative overflow-hidden h-52">
                  {service.images && service.images.length > 0 ? (
                    <img
                      src={service.images[0]}
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.src = 'https://via.placeholder.com/400x200?text=Sem+Imagem';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-100 via-cyan-50 to-blue-50 flex flex-col items-center justify-center group-hover:from-blue-200 group-hover:to-cyan-100 transition-all duration-300">
                      <Scissors className="h-16 w-16 text-blue-400 mb-3 group-hover:scale-110 transition-transform duration-300" />
                      <span className="text-sm font-medium text-blue-500">{service.category}</span>
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg">
                    <span className="text-xs font-semibold text-gray-600 uppercase">{service.category}</span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">{service.title}</h3>
                    </div>
                    {service.average_rating !== null && (
                      <div className="flex items-center bg-gradient-to-r from-yellow-50 to-orange-50 px-3 py-1.5 rounded-full border border-yellow-200 shadow-sm">
                        <Star className="h-4 w-4 text-yellow-500 mr-1 fill-current" />
                        <span className="text-sm font-bold text-yellow-700">
                          {service.average_rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <p className="text-gray-600 line-clamp-2 text-sm leading-relaxed mb-4">{service.description}</p>
                  <div className="flex items-center p-3 bg-gray-50 rounded-xl mb-4">
                    <img
                      src={service.professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(service.professional.business_name || service.professional.full_name)}&background=random`}
                      alt={service.professional.business_name || service.professional.full_name}
                      className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                    />
                    <div className="ml-3 flex-1">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Profissional</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {service.professional.business_name || service.professional.full_name}
                      </div>
                    </div>
                  </div>
                  {(service.professional.business_address || service.professional.business_phone) && (
                    <div className="mt-3 space-y-1 text-xs text-gray-500">
                      {service.professional.business_address && (
                        <div className="flex items-start">
                          <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{service.professional.business_address}</span>
                        </div>
                      )}
                      {service.professional.business_phone && (
                        <div className="flex items-center">
                          <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                          <span>{service.professional.business_phone}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-4 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl">
                    <div>
                      <div className="text-xs text-gray-600 mb-1">Preço</div>
                      <span className="text-2xl font-bold text-blue-600">
                        {formatCurrency(service.price)}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-600 mb-1">Duração</div>
                      <span className="text-sm font-semibold text-gray-700 flex items-center">
                        <Clock className="h-4 w-4 mr-1 text-blue-600" />
                        {service.duration}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      to={`/services/${service.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Agendar
                    </Link>
                    {service.whatsapp_number && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWhatsAppClick(service);
                        }}
                        className="flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white font-semibold rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm"
                        aria-label="Contactar via WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedService && <ServiceDetailsPopup service={selectedService} />}

      {/* How It Works Section */}
      <div className="bg-blue-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
            Como Funciona
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Pesquisar
              </h3>
              <p className="text-gray-600">
                Encontre o serviço perfeito
              </p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Marcar
              </h3>
              <p className="text-gray-600">
                Escolha o horário preferido
              </p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Star className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Desfrutar
              </h3>
              <p className="text-gray-600">
                Experimente um serviço de qualidade
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Dashboard };
