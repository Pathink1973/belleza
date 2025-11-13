import { useState } from 'react';
import { Star, X, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { format, differenceInDays } from 'date-fns';
import { ptLocale } from '../i18n';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  original_created_at?: string;
  service: {
    title: string;
  };
  professional: {
    full_name: string;
  };
}

interface ReviewEditModalProps {
  review: Review;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReviewEditModal({ review, onClose, onSuccess }: ReviewEditModalProps) {
  const [rating, setRating] = useState(review.rating);
  const [comment, setComment] = useState(review.comment);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const creationDate = review.original_created_at || review.created_at;
  const daysOld = differenceInDays(new Date(), new Date(creationDate));
  const canEdit = daysOld <= 30;

  const handleSubmit = async () => {
    if (!comment.trim()) {
      setError('Por favor, escreva um comentário');
      return;
    }

    if (!canEdit) {
      setError('Não é possível editar avaliações com mais de 30 dias');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('reviews')
        .update({
          rating,
          comment: comment.trim()
        })
        .eq('id', review.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error updating review:', err);
      setError(err.message || 'Erro ao atualizar avaliação');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) {
      setError('Não é possível eliminar avaliações com mais de 30 dias');
      return;
    }

    if (!confirm('Tem a certeza que deseja eliminar esta avaliação? Esta ação não pode ser revertida.')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('reviews')
        .delete()
        .eq('id', review.id);

      if (deleteError) throw deleteError;

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error deleting review:', err);
      setError(err.message || 'Erro ao eliminar avaliação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Editar Avaliação</h2>
            <p className="text-yellow-100 text-sm mt-1">{review.service.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 flex items-start border border-red-200">
              <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-red-700">{error}</div>
            </div>
          )}

          {!canEdit && (
            <div className="rounded-lg bg-yellow-50 p-4 flex items-start border border-yellow-200">
              <AlertCircle className="h-5 w-5 text-yellow-500 mr-3 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-700">
                Esta avaliação tem mais de 30 dias e não pode ser editada ou eliminada.
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">
              Profissional: <span className="font-medium text-gray-900">{review.professional.full_name}</span>
            </p>
            <p className="text-sm text-gray-600">
              Avaliado em: <span className="font-medium text-gray-900">{format(new Date(creationDate), 'PPP', { locale: ptLocale })}</span>
            </p>
            {daysOld > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                {canEdit ? `Pode editar durante mais ${30 - daysOld} dia${30 - daysOld !== 1 ? 's' : ''}` : 'Período de edição expirado'}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Classificação
            </label>
            <div className="flex justify-center space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  disabled={!canEdit || loading}
                  className="transition-transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Star
                    className={`h-10 w-10 ${
                      star <= rating
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
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={5}
              disabled={!canEdit || loading}
              placeholder="Partilhe a sua experiência com este serviço..."
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-yellow-500 focus:ring-yellow-500 px-4 py-3 text-gray-900 placeholder-gray-400 resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50"
            >
              Cancelar
            </button>
            {canEdit && (
              <>
                <button
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Eliminar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !comment.trim()}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-semibold rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all shadow-lg shadow-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center"
                >
                  {loading ? 'A guardar...' : (
                    <>
                      <Star className="h-5 w-5 mr-2" />
                      Guardar
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
