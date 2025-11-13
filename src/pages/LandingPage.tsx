import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  MapPin,
  Calendar,
  CalendarCheck,
  Clock,
  Star,
  TrendingUp,
  Users,
  Globe,
  Sparkles,
  Scissors,
  MessageCircle,
  ChevronRight,
  CheckCircle,
  Phone,
  Instagram
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../utils/currency';
import { GlowCard } from '../components/ui/spotlight-card';
import { LandingAccordionItem } from '../components/ui/interactive-image-accordion';
import { handleWhatsAppClick } from '../utils/whatsapp';

interface CategoryData {
  name: string;
  count: number;
}

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  images: string[];
  category: string;
  whatsapp_number: string;
  professional: {
    full_name: string;
    avatar_url: string | null;
    business_name: string | null;
    business_address: string | null;
    business_phone: string | null;
  };
  average_rating: number | null;
  availability_slots?: AvailabilitySlot[];
}

export function LandingPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState('');
  const [featuredServices, setFeaturedServices] = useState<Service[]>([]);
  const [topProfessionals, setTopProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [allLocations, setAllLocations] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryData[]>([]);

  const defaultCategories = [
    { name: 'Cabelo e penteado', count: 0 },
    { name: 'Unhas', count: 0 },
    { name: 'Sobrancelhas', count: 0 },
    { name: 'Massagem', count: 0 },
    { name: 'Barbearia', count: 0 },
    { name: 'Depilação', count: 0 },
    { name: 'Tratamento Facial', count: 0 },
    { name: 'Tratamento Corporal', count: 0 },
    { name: 'Injectáveis', count: 0 },
    { name: 'Tatuagem e piercing', count: 0 },
    { name: 'Maquilhagem', count: 0 },
    { name: 'Fitness', count: 0 }
  ];

  const testimonials = [
    {
      name: 'Maria Silva',
      location: 'Lisboa',
      rating: 5,
      comment: 'Adorei a facilidade de marcar! Encontrei o salão perfeito perto de casa.',
      avatar: 'https://ui-avatars.com/api/?name=Maria+Silva&background=random'
    },
    {
      name: 'João Costa',
      location: 'Porto',
      rating: 5,
      comment: 'Excelente plataforma. Sempre encontro profissionais de qualidade.',
      avatar: 'https://ui-avatars.com/api/?name=Joao+Costa&background=random'
    },
    {
      name: 'Ana Pereira',
      location: 'Braga',
      rating: 5,
      comment: 'Muito prático e rápido. Recomendo a todos!',
      avatar: 'https://ui-avatars.com/api/?name=Ana+Pereira&background=random'
    }
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: services } = await supabase
          .from('services')
          .select(`
            *,
            professional:profiles!services_professional_id_fkey(
              full_name,
              avatar_url,
              business_name,
              business_address,
              business_phone
            ),
            reviews(rating)
          `)
          .order('is_featured', { ascending: false })
          .order('featured_priority', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(9);

        if (services) {
          const servicesWithAvailability = await Promise.all(
            services.map(async (service) => {
              const { data: availability } = await supabase
                .from('availability')
                .select('id, day_of_week, start_time, end_time, is_available')
                .eq('professional_id', service.professional_id)
                .eq('is_available', true)
                .order('day_of_week', { ascending: true })
                .order('start_time', { ascending: true });

              return {
                ...service,
                average_rating: service.reviews && service.reviews.length > 0
                  ? service.reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / service.reviews.length
                  : null,
                availability_slots: availability || []
              };
            })
          );
          setFeaturedServices(servicesWithAvailability);
        }

        const { data: professionals } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, business_name, business_description')
          .eq('role', 'professional')
          .limit(4);

        if (professionals) {
          setTopProfessionals(professionals);
        }

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('business_address')
          .not('business_address', 'is', null)
          .eq('role', 'professional');

        if (profilesData) {
          const locations = new Set<string>();
          profilesData.forEach(profile => {
            if (profile.business_address) {
              const parts = profile.business_address.split(',').map(p => p.trim());
              parts.forEach(part => {
                if (part.length > 2) {
                  locations.add(part);
                }
              });
            }
          });
          setAllLocations(Array.from(locations).sort());
        }

        const { data: servicesForCategories } = await supabase
          .from('services')
          .select('category');

        if (servicesForCategories) {
          const categoryCounts = new Map<string, number>();
          servicesForCategories.forEach(service => {
            if (service.category) {
              const count = categoryCounts.get(service.category) || 0;
              categoryCounts.set(service.category, count + 1);
            }
          });

          const categoryList = defaultCategories.map(defaultCat => ({
            name: defaultCat.name,
            count: categoryCounts.get(defaultCat.name) || 0
          }));

          setCategories(categoryList.filter(cat => cat.count > 0).slice(0, 12));
        } else {
          setCategories(defaultCategories.slice(0, 12));
        }
      } catch (error: any) {
        console.error('Error fetching landing page data:', error);
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          details: error?.details,
          hint: error?.hint
        });
        setCategories(defaultCategories.slice(0, 12));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.append('search', searchQuery.trim());
    if (location.trim()) params.append('location', location.trim());
    navigate(`/services?${params.toString()}`);
  };

  const handleLocationChange = (value: string) => {
    setLocation(value);
    if (value.length > 1) {
      const filtered = allLocations.filter(loc =>
        loc.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      setLocationSuggestions(filtered);
      setShowLocationSuggestions(filtered.length > 0);
    } else {
      setShowLocationSuggestions(false);
    }
  };

  const handleLocationSelect = (selectedLocation: string) => {
    setLocation(selectedLocation);
    setShowLocationSuggestions(false);
  };

  const formatAvailabilityDisplay = (slots: AvailabilitySlot[]) => {
    if (!slots || slots.length === 0) return null;

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const today = new Date().getDay();

    const groupedByDay = slots.reduce((acc, slot) => {
      if (!acc[slot.day_of_week]) {
        acc[slot.day_of_week] = [];
      }
      acc[slot.day_of_week].push(slot);
      return acc;
    }, {} as Record<number, AvailabilitySlot[]>);

    const dayOrder = [1, 2, 3, 4, 5, 6];
    const allDays = [];

    for (const dayIndex of dayOrder) {
      if (groupedByDay[dayIndex]) {
        const daySlots = groupedByDay[dayIndex];
        const firstSlot = daySlots[0];
        const lastSlot = daySlots[daySlots.length - 1];

        allDays.push({
          day: dayNames[dayIndex],
          start: firstSlot.start_time.substring(0, 5),
          end: lastSlot.end_time.substring(0, 5),
          isToday: dayIndex === today
        });
      }
    }

    return allDays;
  };

  return (
    <div className="min-h-screen animated-pastel-gradient">
      {/* Header with Logo */}
      <header className="absolute top-0 left-0 right-0 z-50 px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3">
            <img
              src="/icons/belleza-logo.svg"
              alt="Belleza"
              className="h-8 sm:h-10 w-auto"
            />
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              to="/auth/login"
              className="text-gray-700 hover:text-blue-600 font-semibold transition-colors text-base min-h-[52px] flex items-center px-4 active:scale-[0.97] touch-manipulation tracking-wide"
            >
              Entrar
            </Link>
            <Link
              to="/auth/register"
              className="px-6 sm:px-7 py-3 sm:py-3.5 min-h-[52px] sm:min-h-[54px] bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-xl active:scale-[0.97] transition-all duration-200 text-base flex items-center justify-center touch-manipulation shadow-lg tracking-wide"
            >
              Registar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-24 sm:pt-32 pb-16 sm:pb-32 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h1 className="font-abril text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold text-gray-900 mb-4 sm:mb-6 leading-tight px-2">
              Reserve serviços de beleza<br />
              <span className="bg-gradient-to-r from-blue-600 to-blue-600 bg-clip-text text-transparent">
                e bem-estar
              </span> na sua região
            </h1>
            <p className="text-base sm:text-xl text-gray-600 max-w-2xl mx-auto mb-6 sm:mb-8 px-4">
              Descubra e marque com os melhores profissionais perto de si
            </p>
          </div>

          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSearch} className="bg-white rounded-xl sm:rounded-2xl shadow-2xl p-2 sm:p-3 md:p-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3">
                <div className="md:col-span-5">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Procurar serviços..."
                    className="w-full px-4 py-3 sm:py-4 text-sm sm:text-base text-gray-900 placeholder-gray-400 border-0 focus:ring-0 rounded-xl bg-gray-50 focus:bg-white transition-all duration-200"
                  />
                </div>
                <div className="md:col-span-4 relative">
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    onFocus={() => location.length > 1 && locationSuggestions.length > 0 && setShowLocationSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowLocationSuggestions(false), 200)}
                    placeholder="Localização..."
                    className="w-full px-4 py-3 sm:py-4 text-sm sm:text-base text-gray-900 placeholder-gray-400 border-0 focus:ring-0 rounded-xl bg-gray-50 focus:bg-white transition-all duration-200"
                  />
                  {showLocationSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-48 overflow-y-auto">
                      {locationSuggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleLocationSelect(suggestion)}
                          className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center gap-2 border-b border-gray-100 last:border-b-0"
                        >
                          <MapPin className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="text-gray-900">{suggestion}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="md:col-span-3">
                  <button
                    type="submit"
                    className="w-full py-4 min-h-[56px] bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 hover:shadow-2xl active:scale-[0.97] transition-all duration-200 text-base touch-manipulation shadow-lg tracking-wide"
                  >
                    Pesquisar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Featured Services */}
      {!loading && featuredServices.length > 0 && (
        <section className="py-12 sm:py-20 px-3 sm:px-4 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 sm:mb-12 gap-4">
              <div>
                <h2 className="font-abril text-4xl font-semibold text-gray-900 mb-2">
                  Serviços em destaque
                </h2>
                <p className="text-xl text-gray-600">
                  Os mais populares perto de si
                </p>
              </div>
              <Link
                to="/services"
                className="hidden md:inline-flex items-center text-blue-600 font-semibold hover:text-blue-700"
              >
                Ver todos
                <ChevronRight className="ml-2 h-5 w-5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {featuredServices.map((service) => (
                <div
                  key={service.id}
                  className="group bg-white rounded-2xl overflow-hidden hover:shadow-xl transition-all duration-300 border border-gray-100"
                >
                  {service.images && service.images.length > 0 ? (
                    <div className="relative h-56 overflow-hidden">
                      <img
                        src={service.images[0]}
                        alt={service.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80';
                        }}
                      />
                      {service.average_rating !== null && (
                        <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full shadow-lg flex items-center">
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mr-1" />
                          <span className="font-semibold text-gray-900">{service.average_rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="h-56 bg-gradient-to-br from-blue-100 to-blue-100 flex items-center justify-center">
                      <Scissors className="h-16 w-16 text-blue-300" />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-center mb-3">
                      <img
                        src={service.professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(service.professional.business_name || service.professional.full_name)}&background=random`}
                        alt={service.professional.business_name || service.professional.full_name}
                        className="h-8 w-8 rounded-full object-cover mr-3"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {service.professional.business_name || service.professional.full_name}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {service.title}
                    </h3>
                    <p className="text-gray-600 line-clamp-2 mb-4 text-sm">
                      {service.description}
                    </p>
                    {(service.professional.business_address || service.professional.business_phone) && (
                      <div className="mb-4 space-y-1 text-xs text-gray-500">
                        {service.professional.business_address && (
                          <div className="flex items-start">
                            <MapPin className="h-3 w-3 mr-1 mt-0.5 flex-shrink-0 text-blue-600" />
                            <span className="line-clamp-1">{service.professional.business_address}</span>
                          </div>
                        )}
                        {service.professional.business_phone && (
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-1 flex-shrink-0 text-blue-600" />
                            <a
                              href={`tel:${service.professional.business_phone}`}
                              className="hover:text-blue-600 transition-colors"
                            >
                              {service.professional.business_phone}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                    {service.availability_slots && service.availability_slots.length > 0 && (() => {
                      const availabilityDays = formatAvailabilityDisplay(service.availability_slots);
                      return availabilityDays && availabilityDays.length > 0 ? (
                        <div className="mb-3 pb-3 border-b border-gray-100">
                          <div className="grid grid-cols-2 gap-1.5">
                            {availabilityDays.map((day, idx) => (
                              <div
                                key={idx}
                                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                                  day.isToday
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-gray-50 text-gray-600 border border-gray-200'
                                }`}
                              >
                                <Clock className="h-3 w-3" />
                                <span className="font-medium">{day.day}</span>
                                <span className="text-[10px] opacity-75">{day.start}-{day.end}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null;
                    })()}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center text-gray-500 text-sm">
                        <Clock className="h-4 w-4 mr-1" />
                        {service.duration}
                      </div>
                      <div className="text-xl font-bold text-gray-900">
                        {formatCurrency(service.price)}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <Link
                        to={`/services/${service.id}`}
                        className="btn-gradient inline-flex items-center justify-center flex-1 lg:px-4 lg:py-2 lg:text-sm"
                      >
                        <Calendar className="h-4 w-4 sm:h-5 sm:w-5 lg:h-4 lg:w-4 mr-2.5 flex-shrink-0" />
                        <span>Agendar</span>
                      </Link>
                      {service.whatsapp_number && (
                        <button
                          onClick={() => {
                            handleWhatsAppClick(service.whatsapp_number, {
                              serviceTitle: service.title,
                              servicePrice: service.price,
                              serviceDuration: service.duration,
                              businessName: service.professional.business_name || service.professional.full_name
                            });
                          }}
                          className="btn-whatsapp inline-flex items-center justify-center flex-1 lg:px-4 lg:py-2 lg:text-sm"
                          aria-label="Contactar via WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 lg:h-4 lg:w-4 mr-2.5 flex-shrink-0" />
                          <span>WhatsApp</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories Section */}
      <section className="py-12 sm:py-20 px-3 sm:px-4" style={{ backgroundColor: '#eaeeff' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="font-abril text-2xl sm:text-4xl font-semibold text-gray-900 mb-3 sm:mb-4 px-2">
              Explore por categoria
            </h2>
            <p className="text-base sm:text-xl text-gray-600 px-4">
              Encontre o serviço perfeito para si
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {categories.map((category, index) => (
              <Link
                key={index}
                to={`/services?category=${encodeURIComponent(category.name)}`}
                className="block"
              >
                <GlowCard
                  glowColor={index % 2 === 0 ? 'blue' : 'purple'}
                  customSize={true}
                  variant="white"
                  className="w-full h-full aspect-auto !p-6 hover:scale-105 transition-transform duration-300 cursor-pointer"
                >
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {category.name}
                    </h3>
                    <p className="text-sm text-gray-600">{category.count} {category.count === 1 ? 'serviço' : 'serviços'}</p>
                  </div>
                </GlowCard>
              </Link>
            ))}
          </div>

          <div className="text-center mt-6 sm:mt-10">
            <Link
              to="/categories"
              className="inline-flex items-center text-blue-600 font-semibold hover:text-blue-700"
            >
              Ver todas as categorias
              <ChevronRight className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Platform Benefits Section with Accordion */}
      <section className="py-12 sm:py-20 px-3 sm:px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">

            {/* Left Side: Text Content */}
            <div className="w-full lg:w-1/2 text-center lg:text-left">
              <h2 className="font-['Noto_Serif_Display'] text-3xl sm:text-4xl md:text-5xl font-semibold text-gray-900 mb-4 sm:mb-6 leading-tight">
                Plataforma completa para o seu negócio
              </h2>
              <p className="text-base sm:text-xl text-gray-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Criada para proporcionar uma experiência tranquila para melhorar o seu negócio e elevar a sua marca. Ajuda a aumentar a presença digital do seu salão, facilitando a marcação de serviços diretamente a partir de links, QR codes ou redes sociais. Transforme cada interação online numa oportunidade de negócio.
              </p>

              <div className="mt-8 space-y-4 text-left max-w-xl mx-auto lg:mx-0">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-gray-700">
                    <span className="font-semibold">Marcações 24/7</span>, mesmo fora do horário de atendimento
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-gray-700">
                    <span className="font-semibold">Menos tempo ao telefone</span> a gerir agenda
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-gray-700">
                    <span className="font-semibold">Processo de marcação simples</span> em poucos cliques
                  </p>
                </div>

                <div className="flex items-start gap-4">
                  <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-blue-600" />
                  </div>
                  <p className="text-gray-700">
                    <span className="font-semibold">Maior probabilidade</span> de visitas únicas em clientes recorrentes
                  </p>
                </div>
              </div>
            </div>

            {/* Right Side: Interactive Accordion */}
            <div className="w-full lg:w-1/2">
              <LandingAccordionItem />
            </div>
          </div>
        </div>
      </section>

      {/* Top Professionals */}
      {!loading && topProfessionals.length > 0 && (
        <section className="py-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-abril text-4xl font-semibold text-gray-900 mb-4">
                Profissionais de destaque
              </h2>
              <p className="text-xl text-gray-600">
                Conheça os nossos parceiros certificados
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {topProfessionals.map((professional) => (
                <div
                  key={professional.id}
                  className="bg-white rounded-2xl p-6 text-center hover:shadow-xl transition-all duration-300 border border-gray-100"
                >
                  <img
                    src={professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(professional.business_name || professional.full_name)}&background=random&size=200`}
                    alt={professional.business_name || professional.full_name}
                    className="h-24 w-24 rounded-full object-cover mx-auto mb-4 ring-4 ring-blue-50"
                  />
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {professional.business_name || professional.full_name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {professional.business_description || 'Profissional certificado'}
                  </p>
                  <Link
                    to={`/services?professional=${professional.id}`}
                    className="text-blue-600 text-sm font-semibold hover:text-blue-700"
                  >
                    Ver serviços
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-abril text-4xl font-semibold text-gray-900 mb-4">
              O que dizem os nossos clientes
            </h2>
            <p className="text-xl text-gray-600">
              Milhares de clientes satisfeitos todos os dias
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="bg-gray-50 rounded-2xl p-8 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
                <p className="text-gray-700 mb-6 italic">"{testimonial.comment}"</p>
                <div className="flex items-center">
                  <img
                    src={
                      index === 0 ? 'https://res.cloudinary.com/dfeqzodi3/image/upload/v1762501226/cliente1.webp' :
                      index === 1 ? 'https://res.cloudinary.com/dfeqzodi3/image/upload/v1762501226/cliente3.webp' :
                      index === 2 ? 'https://res.cloudinary.com/dfeqzodi3/image/upload/v1762501515/cliente4.webp' :
                      testimonial.avatar
                    }
                    alt={testimonial.name}
                    className="h-12 w-12 rounded-full object-cover mr-4"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-abril text-4xl font-semibold text-gray-900 mb-4">
              Porquê escolher a nossa plataforma?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
            <div className="text-center">
              <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Sparkles className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Reserva instantânea
              </h3>
              <p className="text-gray-600">
                Marque o seu serviço em segundos, 24/7.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <CheckCircle className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Profissionais verificados
              </h3>
              <p className="text-gray-600">
                Todos os nossos parceiros são selecionados.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-white rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Star className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Avaliações reais
              </h3>
              <p className="text-gray-600">
                Leia opiniões de clientes verificados antes de reservar.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-abril text-4xl md:text-5xl font-semibold mb-6">
            Pronto para começar?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Junte-se a milhares de clientes satisfeitos
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto sm:max-w-none">
            <Link
              to="/auth/register"
              className="px-8 py-4 min-h-[56px] bg-white text-blue-600 font-bold rounded-xl hover:shadow-2xl active:scale-[0.97] transition-all duration-200 text-base flex items-center justify-center touch-manipulation shadow-lg tracking-wide"
            >
              Criar conta grátis
            </Link>
            <Link
              to="/services"
              className="px-8 py-4 min-h-[56px] bg-transparent border-2 border-white text-white font-bold rounded-xl hover:bg-white hover:text-blue-600 active:scale-[0.97] transition-all duration-200 text-base flex items-center justify-center touch-manipulation tracking-wide"
            >
              Explorar serviços
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-8 sm:py-12 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <img
                  src="/icons/belleza-logo.svg"
                  alt="Belleza"
                  className="h-8 w-auto brightness-0 invert"
                />
              </div>
              <p className="text-gray-400 text-sm">
                A plataforma que conecta clientes aos melhores profissionais de beleza e bem-estar. Ajudamos a expandir o seu negócio.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Empresa</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about" className="hover:text-white transition-colors">Sobre nós</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contacto</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Para Profissionais</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/features" className="hover:text-white transition-colors">Funcionalidades</Link></li>
                <li><Link to="/help" className="hover:text-white transition-colors">Centro de ajuda</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/terms" className="hover:text-white transition-colors">Termos de uso</Link></li>
                <li><Link to="/cookies" className="hover:text-white transition-colors">Política de cookies</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
              <p>&copy; 2025 Belleza. Todos os direitos reservados.</p>
              <div className="flex items-center space-x-6 mt-4 md:mt-0">
                <a
                  href="https://www.instagram.com/patriciobrito.cria/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-5 w-5" />
                </a>
                <a
                  href="https://wa.me/351962886031"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
