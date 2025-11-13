import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Plus, Search, Clock, Euro, Filter, Star, CreditCard as Edit, X, MessageCircle, User, Scissors, Trash2, MapPin, Phone, TrendingUp, CheckCircle, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/currency';
import { ServiceVariant } from '../types/service';
import { handleWhatsAppClick } from '../utils/whatsapp';
import { searchServices, debounce } from '../utils/search';

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  professional_id: string;
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
  reviews: {
    rating: number;
  }[] | null;
  average_rating: number | null;
}

interface Filters {
  search: string;
  location: string;
  minPrice: string;
  maxPrice: string;
  duration: string;
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';
  category: string;
  minRating: string;
  professionalId: string;
}

interface ProfessionalInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
  business_name: string | null;
  business_description: string | null;
  business_address: string | null;
  business_phone: string | null;
}

export function Services() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [filters, setFilters] = useState<Filters>({
    search: searchParams.get('search') || '',
    location: searchParams.get('location') || '',
    minPrice: '',
    maxPrice: '',
    duration: '',
    sortBy: 'relevance',
    category: searchParams.get('category') || '',
    minRating: '',
    professionalId: searchParams.get('professional') || ''
  });
  const [resultCount, setResultCount] = useState<number>(0);
  const [professionalInfo, setProfessionalInfo] = useState<ProfessionalInfo | null>(null);
  const [loadingProfessional, setLoadingProfessional] = useState(false);

  const fetchServices = async () => {
    try {
      if (user?.role === 'professional') {
        let query = supabase
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
            reviews:reviews(rating)
          `)
          .eq('professional_id', user.id);

        if (filters.search) {
          query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
        }

        if (filters.category) {
          query = query.eq('category', filters.category);
        }

        if (filters.minPrice) {
          query = query.gte('price', parseFloat(filters.minPrice));
        }

        if (filters.maxPrice) {
          query = query.lte('price', parseFloat(filters.maxPrice));
        }

        if (filters.duration) {
          query = query.eq('duration', `${filters.duration} minutos`);
        }

        const { data, error } = await query;

        if (error) throw error;

        const serviceIds = (data || []).map(s => s.id);
        const { data: variantsData } = await supabase
          .from('service_variants')
          .select('*')
          .in('service_id', serviceIds)
          .order('display_order', { ascending: true });

        const variantsByServiceId = (variantsData || []).reduce((acc, variant) => {
          if (!acc[variant.service_id]) acc[variant.service_id] = [];
          acc[variant.service_id].push(variant);
          return acc;
        }, {} as Record<string, ServiceVariant[]>);

        const servicesWithRatings = (data || []).map(service => ({
          ...service,
          variants: variantsByServiceId[service.id] || [],
          average_rating: service.reviews && service.reviews.length > 0
            ? service.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / service.reviews.length
            : null
        }));

        let sortedServices = [...servicesWithRatings];
        switch (filters.sortBy) {
          case 'relevance':
            sortedServices.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
            break;
          case 'price_asc':
            sortedServices.sort((a, b) => a.price - b.price);
            break;
          case 'price_desc':
            sortedServices.sort((a, b) => b.price - a.price);
            break;
          case 'rating_desc':
            sortedServices.sort((a, b) => (b.average_rating || 0) - (a.average_rating || 0));
            break;
          case 'newest':
            sortedServices.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
            break;
        }

        setServices(sortedServices);
        setResultCount(sortedServices.length);
      } else {
        const results = await searchServices({
          search: filters.search || undefined,
          location: filters.location || undefined,
          minPrice: filters.minPrice ? parseFloat(filters.minPrice) : undefined,
          maxPrice: filters.maxPrice ? parseFloat(filters.maxPrice) : undefined,
          category: filters.category || undefined,
          minRating: filters.minRating ? parseFloat(filters.minRating) : undefined,
          duration: filters.duration || undefined,
          professionalId: filters.professionalId || undefined,
          sortBy: filters.sortBy
        });

        const serviceIds = results.map(s => s.id);
        const { data: variantsData } = await supabase
          .from('service_variants')
          .select('*')
          .in('service_id', serviceIds)
          .order('display_order', { ascending: true });

        const variantsByServiceId = (variantsData || []).reduce((acc, variant) => {
          if (!acc[variant.service_id]) acc[variant.service_id] = [];
          acc[variant.service_id].push(variant);
          return acc;
        }, {} as Record<string, ServiceVariant[]>);

        const servicesWithVariants = results.map(service => ({
          ...service,
          variants: variantsByServiceId[service.id] || []
        }));

        setServices(servicesWithVariants as any);
        setResultCount(servicesWithVariants.length);
      }
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debouncedFetch = debounce(fetchServices, 300);
    debouncedFetch();
  }, [user, filters]);

  useEffect(() => {
    const search = searchParams.get('search');
    const location = searchParams.get('location');
    const category = searchParams.get('category');
    const professional = searchParams.get('professional');

    setFilters(prev => ({
      ...prev,
      search: search || '',
      location: location || '',
      category: category || '',
      professionalId: professional || ''
    }));
  }, [searchParams]);

  useEffect(() => {
    const fetchProfessionalInfo = async () => {
      if (!filters.professionalId) {
        setProfessionalInfo(null);
        return;
      }

      setLoadingProfessional(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, business_name, business_description, business_address, business_phone')
          .eq('id', filters.professionalId)
          .maybeSingle();

        if (error) throw error;
        setProfessionalInfo(data);
      } catch (error) {
        console.error('Error fetching professional info:', error);
        setProfessionalInfo(null);
      } finally {
        setLoadingProfessional(false);
      }
    };

    fetchProfessionalInfo();
  }, [filters.professionalId]);

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleServiceClick = (service: Service) => {
    setSelectedService(service);
  };

  const handleDeleteService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;

      setServices(services.filter(s => s.id !== serviceId));
      setDeletingService(null);
    } catch (error) {
      console.error('Error deleting service:', error);
      alert(t('services.details.errors.deleteError'));
    }
  };

  const handleClosePopup = () => {
    setSelectedService(null);
  };

  const handleWhatsAppClickPopup = (service: Service, variant?: ServiceVariant) => {
    const businessDisplayName = service.professional.business_name || service.professional.full_name;

    handleWhatsAppClick(service.whatsapp_number, {
      serviceTitle: service.title,
      servicePrice: variant ? undefined : service.price,
      serviceDuration: variant ? undefined : service.duration,
      businessName: businessDisplayName,
      variant: variant
    });
  };

  const ServiceDetailsPopup = ({ service }: { service: Service }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] overflow-y-auto">
        <div className="relative">
          {service.images && service.images.length > 0 && (
            <div className="grid grid-cols-2 gap-2 p-2">
              {service.images.map((imageUrl, index) => (
                <img
                  key={index}
                  src={imageUrl}
                  alt={`${service.title} - Imagem ${index + 1}`}
                  className={`${service.images.length === 1 ? 'col-span-2 h-64' : 'h-48'} w-full object-cover rounded-lg`}
                />
              ))}
            </div>
          )}
          <button
            onClick={handleClosePopup}
            className="absolute top-4 right-4 p-3 min-h-[48px] min-w-[48px] bg-white rounded-full shadow-lg hover:bg-gray-100 active:scale-90 transition-all duration-200 z-10 touch-manipulation flex items-center justify-center"
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
              {!(service.variants && service.variants.length > 0) && (
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(service.price)}
                </span>
              )}
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

          {service.variants && service.variants.length > 0 ? (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('services.details.priceOptions')}</h3>
              <div className="space-y-3">
                {service.variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{variant.name}</p>
                      <div className="flex items-center text-sm text-gray-500 mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        <span>{variant.duration}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold text-blue-600">
                        {formatCurrency(variant.price)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWhatsAppClickPopup(service, variant);
                        }}
                        className="btn-whatsapp inline-flex items-center text-sm whitespace-nowrap leading-none"
                      >
                        <MessageCircle className="h-4 w-4 mr-2 sm:mr-2.5 flex-shrink-0" />
                        WhatsApp
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex items-center text-gray-600">
              <Clock className="h-5 w-5 mr-2 text-blue-600" />
              <span>{service.duration}</span>
            </div>
          )}

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('services.details.description')}</h3>
            <p className="text-gray-600 whitespace-pre-line">{service.description}</p>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">{t('services.details.establishment')}</h3>
            <div className="flex items-start space-x-3 mb-4">
              <img
                src={service.professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(service.professional.business_name || service.professional.full_name)}&background=random`}
                alt={service.professional.business_name || service.professional.full_name}
                className="h-12 w-12 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="text-base font-medium text-gray-900">{service.professional.business_name || service.professional.full_name}</p>
                <p className="text-sm text-gray-500">{service.professional.business_description || t('services.details.professional')}</p>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('services.details.team')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {service.team.map((member: any) => (
                  <div key={member.id} className="relative">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <img
                          src={member.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`}
                          alt={member.name}
                          className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-md"
                          onError={(e) => {
                            const img = e.target as HTMLImageElement;
                            img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=random`;
                          }}
                        />
                        {member.is_primary && (
                          <div className="absolute -bottom-1 -right-1 bg-blue-600 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center">
                            <CheckCircle className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-gray-900 block truncate">{member.name}</span>
                        {member.is_primary && (
                          <span className="text-xs text-blue-600 font-semibold">Principal</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-end sticky bottom-0 bg-white pt-4 pb-2 border-t sm:border-0 sm:static">
            <button
              onClick={() => handleWhatsAppClickPopup(service)}
              className="btn-whatsapp inline-flex items-center justify-center w-full sm:w-auto min-h-[56px]"
            >
              <MessageCircle className="h-5 w-5 mr-2.5" />
              {t('services.details.actions.contactViaWhatsApp')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {user?.role === 'professional' ? t('services.yourServices') : t('services.availableServices')}
        </h1>
        {user?.role === 'professional' && (
          <Link
            to="/professional/services/new"
            className="btn-gradient inline-flex items-center"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('services.addService')}
          </Link>
        )}
      </div>

      {professionalInfo && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-blue-100 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <img
                src={professionalInfo.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(professionalInfo.business_name || professionalInfo.full_name)}&background=random&size=120`}
                alt={professionalInfo.business_name || professionalInfo.full_name}
                className="h-16 w-16 rounded-full object-cover ring-4 ring-white shadow-md"
              />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {professionalInfo.business_name || professionalInfo.full_name}
                </h2>
                {professionalInfo.business_description && (
                  <p className="text-gray-600 mt-1">{professionalInfo.business_description}</p>
                )}
                {professionalInfo.business_address && (
                  <div className="flex items-center text-sm text-gray-500 mt-2">
                    <MapPin className="h-4 w-4 mr-1 text-blue-600" />
                    <span>{professionalInfo.business_address}</span>
                  </div>
                )}
                {professionalInfo.business_phone && (
                  <div className="flex items-center text-sm text-gray-500 mt-1">
                    <Phone className="h-4 w-4 mr-1 text-blue-600" />
                    <a
                      href={`tel:${professionalInfo.business_phone}`}
                      className="hover:text-blue-600 transition-colors"
                    >
                      {professionalInfo.business_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setFilters(prev => ({ ...prev, professionalId: '' }));
                navigate('/services');
              }}
              className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              {t('services.details.actions.viewAllServices')}
            </button>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl sm:rounded-2xl shadow-lg border border-slate-200 p-4 sm:p-6">
        {!user && resultCount > 0 && (
          <div className="mb-6 p-4 bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-50 rounded-xl border-2 border-blue-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-200">
                <TrendingUp className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-700">{t('services.resultsFound')}</span>
                  <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{resultCount}</span>
                  <span className="text-sm font-medium text-slate-700">{t('services.resultsText')}</span>
                </div>
                {(filters.search || filters.location) && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {filters.search && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-blue-200 text-xs font-medium text-slate-600">
                        <Search className="h-3 w-3 mr-1.5 text-blue-500" />
                        "{filters.search}"
                      </span>
                    )}
                    {filters.location && (
                      <span className="inline-flex items-center px-3 py-1 rounded-full bg-white border border-blue-200 text-xs font-medium text-slate-600">
                        <MapPin className="h-3 w-3 mr-1.5 text-blue-500" />
                        "{filters.location}"
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder={t('services.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="input-glow px-4 w-full rounded-xl border-slate-200 shadow-sm bg-white transition-all duration-200"
            />
          </div>
          {!user?.role && (
            <div className="flex-1">
              <input
                type="text"
                placeholder={t('services.locationPlaceholder')}
                value={filters.location}
                onChange={(e) => handleFilterChange('location', e.target.value)}
                className="input-glow px-4 w-full rounded-xl border-slate-200 shadow-sm bg-white transition-all duration-200"
              />
            </div>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center justify-center px-5 py-3 min-h-[52px] min-w-[52px] border-2 border-slate-200 rounded-xl text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-200 shadow-sm font-semibold touch-manipulation"
          >
            <Filter className="h-5 w-5 mr-2" />
            <span className="hidden sm:inline">{t('services.filters')}</span>
          </button>
          <select
            value={filters.sortBy}
            onChange={(e) => handleFilterChange('sortBy', e.target.value as Filters['sortBy'])}
            className="input-glow rounded-xl border-slate-200 shadow-sm bg-white font-medium text-slate-700"
          >
            {!user?.role && <option value="relevance">{t('services.sort.relevance')}</option>}
            <option value="newest">{t('services.sort.newest')}</option>
            <option value="price_asc">{t('services.sort.priceLowToHigh')}</option>
            <option value="price_desc">{t('services.sort.priceHighToLow')}</option>
            <option value="rating_desc">{t('services.sort.highestRated')}</option>
          </select>
        </div>

        {showFilters && (
          <div className="mt-4 sm:mt-6 p-6 sm:p-8 bg-gradient-to-br from-white via-blue-50/30 to-cyan-50/30 rounded-2xl border-2 border-blue-200 shadow-xl backdrop-blur-sm animate-in fade-in duration-300">
            {/* Filter Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-blue-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                  <Filter className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Filtros Avançados</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Refine sua pesquisa</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setFilters({
                    search: '',
                    location: '',
                    minPrice: '',
                    maxPrice: '',
                    duration: '',
                    sortBy: user?.role === 'professional' ? 'newest' : 'relevance',
                    category: '',
                    minRating: '',
                    professionalId: ''
                  });
                  setShowFilters(false);
                }}
                className="group px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md border-2 border-slate-200 hover:border-red-300 bg-white"
              >
                <X className="h-4 w-4 mr-1.5 inline-block group-hover:rotate-90 transition-transform duration-200" />
                {t('services.filtersTitle.reset')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Price Range Section */}
              <div className="md:col-span-2 lg:col-span-1">
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Euro className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Faixa de Preço</h4>
                    <p className="text-xs text-slate-500">Defina seu orçamento</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                      {t('services.filtersTitle.minPrice')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0"
                      value={filters.minPrice}
                      onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                      className="input-glow px-4 block w-full rounded-xl border-2 border-slate-200 shadow-sm bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all font-semibold text-slate-700 hover:border-emerald-300"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-2">
                      {t('services.filtersTitle.maxPrice')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="999"
                      value={filters.maxPrice}
                      onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                      className="input-glow px-4 block w-full rounded-xl border-2 border-slate-200 shadow-sm bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 transition-all font-semibold text-slate-700 hover:border-emerald-300"
                    />
                  </div>
                </div>
              </div>

              {/* Duration Section */}
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-sm">
                    <Clock className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Duração</h4>
                    <p className="text-xs text-slate-500">Tempo do serviço</p>
                  </div>
                </div>
                <select
                  value={filters.duration}
                  onChange={(e) => handleFilterChange('duration', e.target.value)}
                  className="input-glow px-4 block w-full rounded-xl border-2 border-slate-200 shadow-sm bg-white font-semibold text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all hover:border-blue-300 appearance-none cursor-pointer"
                >
                  <option value="">{t('services.filtersTitle.anyDuration')}</option>
                  <option value="30">⏱️ 30 {t('services.filtersTitle.minutes')}</option>
                  <option value="45">⏱️ 45 {t('services.filtersTitle.minutes')}</option>
                  <option value="60">⏱️ 1 {t('services.filtersTitle.hour')}</option>
                  <option value="90">⏱️ 1.5 {t('services.filtersTitle.hours')}</option>
                  <option value="120">⏱️ 2 {t('services.filtersTitle.hours')}</option>
                </select>
              </div>

              {/* Rating Section */}
              {!user?.role && (
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-sm">
                      <Star className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">Avaliação Mínima</h4>
                      <p className="text-xs text-slate-500">Qualidade garantida</p>
                    </div>
                  </div>
                  <select
                    value={filters.minRating}
                    onChange={(e) => handleFilterChange('minRating', e.target.value)}
                    className="input-glow px-4 block w-full rounded-xl border-2 border-slate-200 shadow-sm bg-white font-semibold text-slate-700 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all hover:border-amber-300 appearance-none cursor-pointer"
                  >
                    <option value="">{t('services.filtersTitle.anyRating')}</option>
                    <option value="4">⭐ 4+ {t('services.filtersTitle.stars')}</option>
                    <option value="4.5">⭐ 4.5+ {t('services.filtersTitle.stars')}</option>
                    <option value="5">⭐ 5 {t('services.filtersTitle.stars')}</option>
                  </select>
                </div>
              )}
            </div>

            {/* Active Filters Display */}
            {(filters.minPrice || filters.maxPrice || filters.duration || filters.minRating) && (
              <div className="mt-6 pt-6 border-t-2 border-blue-100">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-slate-700">Filtros Ativos:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {filters.minPrice && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 text-xs font-bold text-emerald-700 shadow-sm">
                      <Euro className="h-3 w-3 mr-1.5" />
                      Mín: €{filters.minPrice}
                    </span>
                  )}
                  {filters.maxPrice && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 text-xs font-bold text-emerald-700 shadow-sm">
                      <Euro className="h-3 w-3 mr-1.5" />
                      Máx: €{filters.maxPrice}
                    </span>
                  )}
                  {filters.duration && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 text-xs font-bold text-blue-700 shadow-sm">
                      <Clock className="h-3 w-3 mr-1.5" />
                      {filters.duration} min
                    </span>
                  )}
                  {filters.minRating && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 text-xs font-bold text-amber-700 shadow-sm">
                      <Star className="h-3 w-3 mr-1.5" />
                      {filters.minRating}+ estrelas
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {services.map((service) => (
          <div
            key={service.id}
            onClick={() => handleServiceClick(service)}
            className="group block card-gradient hover:shadow-lg transition-shadow duration-200 cursor-pointer overflow-hidden relative"
          >
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
              <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-50 flex flex-col items-center justify-center group-hover:from-blue-200 group-hover:to-blue-100 transition-all duration-200">
                <Scissors className="h-12 w-12 text-blue-300 group-hover:text-blue-400 transition-colors duration-200 mb-2" />
                <span className="text-sm text-blue-400 group-hover:text-blue-500 transition-colors duration-200">
                  {service.category}
                </span>
              </div>
            )}
            {user?.role === 'professional' && service.professional_id === user.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDeletingService(service);
                }}
                className="absolute top-2 right-2 p-2 bg-white bg-opacity-90 rounded-full shadow-md hover:bg-red-50 hover:text-red-600 transition-all duration-200 z-10"
                title={t('services.deleteService')}
              >
                <Trash2 className="h-5 w-5" />
              </button>
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
                  src={service.professional.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(service.professional.business_name || service.professional.full_name)}&background=random`}
                  alt={service.professional.business_name || service.professional.full_name}
                  className="h-8 w-8 rounded-full object-cover"
                />
                <span className="ml-2 text-sm text-gray-600">
                  {service.professional.business_name || service.professional.full_name}
                </span>
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
              <div className="mt-4 flex justify-between items-center">
                {service.variants && service.variants.length > 0 ? (
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-500">{t('services.details.startingFrom')}</span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(Math.min(...service.variants.map(v => v.price)))}
                    </span>
                    <span className="text-xs text-gray-500">{service.variants.length} {t('services.details.options')}</span>
                  </div>
                ) : (
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(service.price)}
                  </span>
                )}
                <span className="text-sm text-gray-500 flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  {service.variants && service.variants.length > 0
                    ? `${service.variants[0].duration}`
                    : service.duration}
                </span>
              </div>
              {!user && (
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Link
                    to={`/services/${service.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="btn-gradient flex items-center justify-center min-h-[52px] flex-1"
                  >
                    <Calendar className="h-5 w-5 mr-2.5 flex-shrink-0" />
                    {t('services.details.actions.book')}
                  </Link>
                  {service.whatsapp_number && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWhatsAppClick(service.whatsapp_number, {
                          serviceTitle: service.title,
                          servicePrice: service.variants && service.variants.length > 0
                            ? Math.min(...service.variants.map(v => v.price))
                            : service.price,
                          serviceDuration: service.variants && service.variants.length > 0
                            ? service.variants[0].duration
                            : service.duration,
                          businessName: service.professional.business_name || service.professional.full_name
                        });
                      }}
                      className="btn-whatsapp flex items-center justify-center min-h-[52px] flex-1"
                      aria-label="Contactar via WhatsApp"
                    >
                      <MessageCircle className="h-5 w-5 mr-2.5 flex-shrink-0" />
                      WhatsApp
                    </button>
                  )}
                </div>
              )}
              {user?.role === 'client' && (
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <Link
                    to={`/services/${service.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="btn-gradient flex items-center justify-center min-h-[52px] flex-1"
                  >
                    <Calendar className="h-5 w-5 mr-2.5 flex-shrink-0" />
                    {t('services.details.actions.book')}
                  </Link>
                  {service.whatsapp_number && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWhatsAppClick(service.whatsapp_number, {
                          serviceTitle: service.title,
                          servicePrice: service.variants && service.variants.length > 0
                            ? Math.min(...service.variants.map(v => v.price))
                            : service.price,
                          serviceDuration: service.variants && service.variants.length > 0
                            ? service.variants[0].duration
                            : service.duration,
                          businessName: service.professional.business_name || service.professional.full_name
                        });
                      }}
                      className="btn-whatsapp flex items-center justify-center min-h-[52px] flex-1"
                      aria-label="Contactar via WhatsApp"
                    >
                      <MessageCircle className="h-5 w-5 mr-2.5 flex-shrink-0" />
                      WhatsApp
                    </button>
                  )}
                </div>
              )}
              {user?.role === 'professional' && (
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingService(service);
                    }}
                    className="btn-gradient flex items-center justify-center min-h-[52px] flex-1"
                  >
                    <Edit className="h-5 w-5 mr-2.5 flex-shrink-0" />
                    {t('services.details.actions.manage')}
                  </button>
                  {service.whatsapp_number && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWhatsAppClick(service.whatsapp_number, {
                          serviceTitle: service.title,
                          servicePrice: service.variants && service.variants.length > 0
                            ? Math.min(...service.variants.map(v => v.price))
                            : service.price,
                          serviceDuration: service.variants && service.variants.length > 0
                            ? service.variants[0].duration
                            : service.duration,
                          businessName: service.professional.business_name || service.professional.full_name
                        });
                      }}
                      className="btn-whatsapp flex items-center justify-center min-h-[52px] flex-1"
                      aria-label="Contactar via WhatsApp"
                    >
                      <MessageCircle className="h-5 w-5 mr-2.5 flex-shrink-0" />
                      WhatsApp
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedService && <ServiceDetailsPopup service={selectedService} />}

      {editingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-xl max-w-md w-full h-full sm:h-auto flex flex-col">
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">{t('services.manageService')}</h2>
                <button
                  onClick={() => setEditingService(null)}
                  className="p-3 min-h-[48px] min-w-[48px] hover:bg-gray-100 rounded-full active:scale-90 transition-all duration-200 touch-manipulation flex items-center justify-center"
                >
                  <X className="h-6 w-6 text-gray-600" />
                </button>
              </div>
              <p className="text-gray-600 mb-6 text-base">{t('services.details.actions.chooseAction')}</p>
            </div>
            <div className="p-6 space-y-3 border-t bg-white">
              <button
                onClick={() => {
                  navigate(`/professional/services/${editingService.id}/edit`);
                }}
                className="w-full flex items-center justify-center px-4 py-4 min-h-[56px] bg-blue-600 text-white rounded-xl hover:bg-blue-700 active:scale-95 transition-all duration-200 font-semibold touch-manipulation"
              >
                <Edit className="h-5 w-5 mr-2" />
                {t('services.details.actions.editFull')}
              </button>
              <button
                onClick={() => setEditingService(null)}
                className="w-full flex items-center justify-center px-4 py-4 min-h-[56px] border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 active:scale-95 transition-all duration-200 font-semibold touch-manipulation"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {services.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            {user?.role === 'professional'
              ? t('services.noServicesCreated')
              : t('services.noServicesAvailable')}
          </p>
        </div>
      )}

      {deletingService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 sm:p-8">
            <div className="flex items-start mb-6">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-7 w-7 text-red-600" />
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-xl font-bold text-gray-900">{t('services.details.actions.confirmDelete')}</h3>
                <p className="mt-2 text-base text-gray-600">
                  {t('services.details.actions.deleteConfirm')} <span className="font-semibold">"{deletingService.title}"</span>?
                </p>
                <p className="mt-2 text-sm text-red-600 font-semibold bg-red-50 p-3 rounded-lg">
                  {t('services.details.actions.deleteWarning')}
                </p>
              </div>
            </div>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setDeletingService(null)}
                className="flex-1 px-4 py-4 min-h-[56px] bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 active:scale-95 transition-all duration-200 font-semibold touch-manipulation"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteService(deletingService.id)}
                className="flex-1 px-4 py-4 min-h-[56px] bg-red-600 text-white rounded-xl hover:bg-red-700 active:scale-95 transition-all duration-200 font-semibold touch-manipulation"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}