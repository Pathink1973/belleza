import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Clock, MessageCircle, Edit, Trash2, User, MapPin, Phone, Star, Calendar, CheckCircle } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { ServiceVariant } from '../types/service';
import { handleWhatsAppClick } from '../utils/whatsapp';

interface AvailabilitySlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  client: {
    full_name: string;
    avatar_url: string | null;
  } | null;
}

interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  professional_id: string;
  image_url: string | null;
  whatsapp_number: string;
  category: string;
  professional: {
    full_name: string;
    avatar_url: string | null;
    business_name: string | null;
    business_description: string | null;
    business_address: string | null;
    business_phone: string | null;
  };
  variants?: ServiceVariant[];
  availability_slots?: AvailabilitySlot[];
  reviews?: Review[];
  average_rating?: number | null;
}

export function ServiceDetails() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [variants, setVariants] = useState<ServiceVariant[]>([]);

  useEffect(() => {
    const fetchService = async () => {
      if (!id || id === 'new') {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
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
            )
          `)
          .eq('id', id)
          .single();

        if (error) throw error;
        setService(data);

        const { data: variantsData } = await supabase
          .from('service_variants')
          .select('*')
          .eq('service_id', id)
          .order('display_order', { ascending: true });

        if (variantsData) {
          setVariants(variantsData);
        }

        const { data: availability } = await supabase
          .from('availability')
          .select('id, day_of_week, start_time, end_time, is_available')
          .eq('professional_id', data.professional_id)
          .eq('is_available', true)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true });

        if (availability) {
          setAvailabilitySlots(availability);
        }

        const { data: reviewsData } = await supabase
          .from('reviews')
          .select(`
            id,
            rating,
            comment,
            created_at,
            client:profiles!reviews_client_id_fkey(
              full_name,
              avatar_url
            )
          `)
          .eq('service_id', id)
          .order('created_at', { ascending: false })
          .limit(10);

        if (reviewsData && reviewsData.length > 0) {
          setReviews(reviewsData);
          const avgRating = reviewsData.reduce((sum, r) => sum + r.rating, 0) / reviewsData.length;
          setAverageRating(avgRating);
        }
      } catch (err) {
        setError(t('services.details.errors.loadError'));
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchService();
  }, [id, t]);

  const handleDelete = async () => {
    if (!window.confirm(t('services.details.actions.deleteConfirm'))) {
      return;
    }

    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id);

      if (error) throw error;
      navigate('/services');
    } catch (err) {
      setError(t('services.details.errors.deleteError'));
      console.error('Error:', err);
    }
  };

  const handleBooking = (variantId?: string) => {
    if (!service) return;
    const url = variantId
      ? `/booking?service=${service.id}&variant=${variantId}`
      : `/booking?service=${service.id}`;
    navigate(url);
  };

  const handleWhatsAppContact = (variant?: ServiceVariant) => {
    if (!service) return;
    const businessDisplayName = service.professional.business_name || service.professional.full_name;

    handleWhatsAppClick(service.whatsapp_number, {
      serviceTitle: service.title,
      servicePrice: variant ? undefined : service.price,
      serviceDuration: variant ? undefined : service.duration,
      businessName: businessDisplayName,
      variant: variant
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || t('services.details.errors.notFound')}</p>
      </div>
    );
  }

  const isOwner = profile?.id === service.professional_id;

  const formatAvailabilityDisplay = () => {
    if (!availabilitySlots || availabilitySlots.length === 0) return [];

    const dayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const today = new Date().getDay();

    const groupedByDay = availabilitySlots.reduce((acc, slot) => {
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
        allDays.push({
          day: dayNames[dayIndex],
          slots: daySlots.map(slot => ({
            start: slot.start_time.substring(0, 5),
            end: slot.end_time.substring(0, 5)
          })),
          isToday: dayIndex === today
        });
      }
    }

    return allDays;
  };

  const availabilityDisplay = formatAvailabilityDisplay();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card-gradient mobile-card-compact">
        {service.image_url && (
          <img
            src={service.image_url}
            alt={service.title}
            className="w-full h-64 object-cover rounded-t-lg"
          />
        )}
        <div className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{service.title}</h1>
            {isOwner && (
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/professional/services/${id}/edit`)}
                  className="btn-compact inline-flex items-center"
                >
                  <Edit className="h-4 w-4 mr-1.5 sm:mr-2" />
                  {t('services.details.actions.edit')}
                </button>
                <button
                  onClick={handleDelete}
                  className="inline-flex items-center px-3 sm:px-4 py-2 min-h-[44px] border border-red-600 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium touch-manipulation"
                >
                  <Trash2 className="h-4 w-4 mr-1.5 sm:mr-2" />
                  {t('services.details.actions.delete')}
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 sm:mt-6 flex items-center">
            {service.professional.avatar_url ? (
              <img
                src={service.professional.avatar_url}
                alt={service.professional.business_name || service.professional.full_name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-6 w-6 text-blue-600" />
              </div>
            )}
            <div className="ml-3 sm:ml-4 flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                {service.professional.business_name || service.professional.full_name}
              </h2>
              <p className="text-sm text-gray-500">{service.professional.business_description || t('services.details.professional')}</p>
            </div>
          </div>

          {(service.professional.business_address || service.professional.business_phone) && (
            <div className="mt-3 sm:mt-4 space-y-2 text-xs sm:text-sm text-gray-600 bg-blue-50 rounded-lg p-3 sm:p-4">
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
                    className="hover:text-blue-600 transition-colors font-medium"
                  >
                    {service.professional.business_phone}
                  </a>
                </div>
              )}
            </div>
          )}

          {availabilityDisplay.length > 0 && (
            <div className="mt-4 sm:mt-6 bg-white border border-gray-200 rounded-lg p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Clock className="h-4 w-4 mr-2 text-blue-600" />
                Horários Disponíveis
              </h3>
              <div className="space-y-2">
                {availabilityDisplay.map((dayInfo, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-2 rounded-md ${
                      dayInfo.isToday ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                    }`}
                  >
                    <span className={`text-sm font-medium ${
                      dayInfo.isToday ? 'text-green-700' : 'text-gray-700'
                    }`}>
                      {dayInfo.day}
                      {dayInfo.isToday && <span className="ml-2 text-xs">(Hoje)</span>}
                    </span>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {dayInfo.slots.map((slot, slotIdx) => (
                        <span
                          key={slotIdx}
                          className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                            dayInfo.isToday
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {slot.start} - {slot.end}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {variants.length > 0 ? (
            <div className="mt-4 sm:mt-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Opções de Preço</h3>
              <div className="space-y-2 sm:space-y-3">
                {variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 sm:p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-900 text-base sm:text-lg truncate">{variant.name}</h4>
                      <div className="flex items-center text-sm text-gray-600 mt-1">
                        <Clock className="h-4 w-4 mr-1 text-blue-600" />
                        <span>{variant.duration}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className="text-xl sm:text-2xl font-bold text-blue-600">
                        {formatCurrency(variant.price)}
                      </span>
                      {!isOwner && (
                        <div className="flex gap-2 sm:gap-3">
                          <button
                            onClick={() => handleBooking(variant.id)}
                            className="btn-gradient inline-flex items-center justify-center whitespace-nowrap"
                          >
                            <Calendar className="h-3.5 w-3.5 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                            <span>Agendar</span>
                          </button>
                          <button
                            onClick={() => handleWhatsAppContact(variant)}
                            className="btn-whatsapp-compact inline-flex items-center justify-center whitespace-nowrap"
                            aria-label="Contactar via WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {!isOwner && (
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleWhatsAppContact()}
                    className="btn-whatsapp inline-flex items-center"
                  >
                    <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 sm:mr-2.5" />
                    Contactar via WhatsApp
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 sm:mt-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 p-3 sm:p-4 bg-white border-2 border-gray-200 rounded-lg">
                <div className="flex items-center gap-6">
                  <div className="flex items-center text-gray-700">
                    <span className="text-2xl font-bold text-blue-600">{formatCurrency(service.price)}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Clock className="h-5 w-5 mr-2 text-blue-600" />
                    <span>{service.duration}</span>
                  </div>
                </div>
                {!isOwner && (
                  <div className="flex gap-2 sm:gap-3">
                    <button
                      onClick={() => handleBooking()}
                      className="btn-gradient inline-flex items-center justify-center whitespace-nowrap"
                    >
                      <Calendar className="h-3.5 w-3.5 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                      <span>Agendar</span>
                    </button>
                    <button
                      onClick={() => handleWhatsAppContact()}
                      className="btn-whatsapp-compact inline-flex items-center justify-center whitespace-nowrap"
                      aria-label="Contactar via WhatsApp"
                    >
                      <MessageCircle className="h-3.5 w-3.5 sm:h-5 sm:w-5 mr-1 sm:mr-2 flex-shrink-0" />
                      <span>WhatsApp</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 sm:mt-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              {t('services.details.description')}
            </h2>
            <p className="text-gray-600 whitespace-pre-line">{service.description}</p>
          </div>

          {reviews.length > 0 && (
            <div className="mt-6 sm:mt-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Avaliações dos Clientes</h2>
                {averageRating !== null && (
                  <div className="flex items-center bg-yellow-50 px-3 py-1.5 rounded-full">
                    <Star className="h-5 w-5 text-yellow-500 mr-1 fill-yellow-500" />
                    <span className="text-lg font-bold text-yellow-700 mr-1">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-sm text-yellow-600">
                      ({reviews.length} {reviews.length === 1 ? 'avaliação' : 'avaliações'})
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-3 sm:space-y-4">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {review.client?.avatar_url ? (
                          <img
                            src={review.client.avatar_url}
                            alt={review.client.full_name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{review.client?.full_name || 'Utilizador'}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(review.created_at).toLocaleDateString('pt-PT', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}