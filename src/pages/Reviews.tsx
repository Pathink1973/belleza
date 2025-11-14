import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { format, parseISO } from 'date-fns';
import { ptLocale } from '../i18n';
import { Star, MessageSquare, AlertCircle, CheckCircle, User, Calendar, ThumbsUp } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  client: {
    full_name: string;
    avatar_url: string | null;
  };
  service: {
    title: string;
  };
  booking: {
    start_time: string;
  };
}

interface PendingReview {
  id: string;
  start_time: string;
  professional_id: string;
  service: {
    id: string;
    title: string;
  };
  professional: {
    full_name: string;
  };
}

export function Reviews() {
  const { user, profile } = useAuthStore();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<PendingReview | null>(null);
  const [newReview, setNewReview] = useState({
    rating: 5,
    comment: ''
  });

  useEffect(() => {
    if (user?.id && profile?.role) {
      if (profile.role === 'professional') {
        fetchProfessionalReviews();
      } else if (profile.role === 'client') {
        fetchClientReviews();
        fetchPendingReviews();
      }
    }
  }, [user?.id, profile?.role]);

  const fetchProfessionalReviews = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          client:profiles!reviews_client_id_fkey(
            full_name,
            avatar_url
          ),
          service:services(title),
          booking:bookings(start_time)
        `)
        .eq('professional_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError('Erro ao carregar avaliações');
    } finally {
      setLoading(false);
    }
  };

  const fetchClientReviews = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          service:services(title),
          booking:bookings(start_time)
        `)
        .eq('client_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError('Erro ao carregar avaliações');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingReviews = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          id,
          start_time,
          professional_id,
          service:services(id, title),
          professional:profiles!bookings_professional_id_fkey(full_name)
        `)
        .eq('client_id', user.id)
        .eq('status', 'concluído')
        .order('start_time', { ascending: false });

      if (error) throw error;

      const bookingsWithoutReviews = [];
      for (const booking of data || []) {
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('booking_id', booking.id)
          .maybeSingle();

        if (!existingReview) {
          bookingsWithoutReviews.push(booking);
        }
      }

      setPendingReviews(bookingsWithoutReviews);
    } catch (err) {
      console.error('Error fetching pending reviews:', err);
    }
  };

  const handleSubmitReview = async () => {
    if (!user?.id || !selectedBooking) return;

    setError('');
    setSuccess('');

    try {
      if (!newReview.comment.trim()) {
        throw new Error('Por favor, escreva um comentário');
      }

      const { error } = await supabase
        .from('reviews')
        .insert({
          booking_id: selectedBooking.id,
          client_id: user.id,
          service_id: selectedBooking.service.id,
          professional_id: selectedBooking.professional_id,
          rating: newReview.rating,
          comment: newReview.comment
        });

      if (error) throw error;

      setSuccess('Avaliação enviada com sucesso');
      setShowReviewModal(false);
      setSelectedBooking(null);
      setNewReview({ rating: 5, comment: '' });

      if (profile?.role === 'client') {
        fetchClientReviews();
        fetchPendingReviews();
      }
    } catch (err: any) {
      console.error('Error submitting review:', err);
      setError(err.message || 'Erro ao enviar avaliação');
    }
  };

  const renderStars = (rating: number, interactive = false, onChange?: (rating: number) => void) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onChange && onChange(star)}
            disabled={!interactive}
            className={`${interactive ? 'cursor-pointer hover:scale-125' : 'cursor-default'} transition-transform duration-200`}
          >
            <Star
              className={`${
                interactive ? 'h-10 w-10' : 'h-5 w-5'
              } ${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Avaliações</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-2">
          {profile?.role === 'professional'
            ? 'Veja as avaliações dos seus clientes'
            : 'Gerencie as suas avaliações'}
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-3" />
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4 flex items-start">
          <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 mr-3" />
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      {profile?.role === 'client' && pendingReviews.length > 0 && (
        <div className="card-gradient p-6 bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-50 border-2 border-yellow-300 shadow-lg">
          <div className="flex items-center mb-4">
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-2 rounded-lg mr-3">
              <ThumbsUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Serviços Pendentes de Avaliação
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Você tem {pendingReviews.length} {pendingReviews.length === 1 ? 'serviço' : 'serviços'} para avaliar
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {pendingReviews.map((booking) => (
              <div
                key={booking.id}
                className="flex items-center justify-between p-5 bg-white rounded-xl border-2 border-yellow-200 hover:border-yellow-300 hover:shadow-md transition-all"
              >
                <div className="flex-1">
                  <p className="font-bold text-gray-900 text-lg">{booking.service.title}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {booking.professional.full_name} • {format(parseISO(booking.start_time), 'PPP', { locale: ptLocale })}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedBooking(booking);
                    setShowReviewModal(true);
                  }}
                  className="inline-flex items-center px-5 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-bold rounded-xl hover:from-yellow-600 hover:to-orange-600 transition-all duration-200 shadow-lg hover:shadow-xl text-sm ml-4"
                >
                  <Star className="h-5 w-5 mr-2 fill-current" />
                  Avaliar Agora
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card-gradient p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">
          {profile?.role === 'professional' ? 'Avaliações Recebidas' : 'Minhas Avaliações'} ({reviews.length})
        </h2>

        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Nenhuma avaliação ainda
            </h3>
            <p className="mt-2 text-gray-500">
              {profile?.role === 'professional'
                ? 'As avaliações dos seus clientes aparecerão aqui'
                : 'As suas avaliações aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="p-6 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    {profile?.role === 'professional' && review.client && (
                      <>
                        {review.client.avatar_url ? (
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
                          <p className="font-medium text-gray-900">{review.client.full_name}</p>
                          <p className="text-sm text-gray-500">{review.service.title}</p>
                        </div>
                      </>
                    )}
                    {profile?.role === 'client' && (
                      <div>
                        <p className="font-medium text-gray-900">{review.service.title}</p>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <Calendar className="h-4 w-4 mr-1" />
                          {format(parseISO(review.booking.start_time), 'PPP', { locale: ptLocale })}
                        </div>
                      </div>
                    )}
                  </div>
                  {renderStars(review.rating)}
                </div>

                <p className="text-gray-700 whitespace-pre-wrap">{review.comment}</p>

                <div className="mt-4 text-xs text-gray-500">
                  {format(parseISO(review.created_at), 'PPp', { locale: ptLocale })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showReviewModal && selectedBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="sticky top-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-5 rounded-t-2xl">
              <h2 className="text-2xl font-bold">Avaliar Serviço</h2>
              <p className="text-yellow-100 text-sm mt-1">{selectedBooking.service.title}</p>
              <p className="text-yellow-100 text-xs mt-1">
                Profissional: {selectedBooking.professional.full_name}
              </p>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Como foi a sua experiência?
                </label>
                <div className="flex justify-center space-x-2">
                  {renderStars(newReview.rating, true, (rating) =>
                    setNewReview({ ...newReview, rating })
                  )}
                </div>
                <p className="text-center text-sm text-gray-500 mt-2">
                  {newReview.rating === 5 && '⭐ Excelente!'}
                  {newReview.rating === 4 && '😊 Muito Bom'}
                  {newReview.rating === 3 && '😐 Bom'}
                  {newReview.rating === 2 && '😕 Razoável'}
                  {newReview.rating === 1 && '😞 Precisa Melhorar'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Comentário *
                </label>
                <textarea
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  rows={6}
                  placeholder="Partilhe a sua experiência com este serviço. O que mais gostou? O que poderia melhorar?"
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 transition-all px-4 py-3 text-gray-900 placeholder-gray-400 resize-none"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Mínimo recomendado: 20 caracteres
                </p>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowReviewModal(false);
                    setSelectedBooking(null);
                    setNewReview({ rating: 5, comment: '' });
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSubmitReview}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg shadow-yellow-500/30 inline-flex items-center justify-center"
                >
                  <Star className="h-5 w-5 mr-2 fill-current" />
                  Enviar Avaliação
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profile?.role === 'professional' && (
        <div className="card-gradient p-6 bg-blue-50 border-blue-200">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-semibold mb-2">Sobre as avaliações:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>As avaliações são feitas pelos clientes após serviços concluídos</li>
                <li>A classificação média é calculada automaticamente</li>
                <li>Avaliações positivas aumentam a visibilidade dos seus serviços</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
