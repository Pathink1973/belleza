import { CheckCircle, XCircle, Calendar, Clock, User, Euro, ArrowRight, Home } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface BookingConfirmationModalProps {
  isOpen: boolean;
  isSuccess: boolean;
  errorMessage?: string;
  bookingDetails?: {
    serviceName: string;
    professionalName: string;
    date: string;
    time: string;
    duration: string;
    price: string;
    variantName?: string;
  };
  onClose: () => void;
  isGuest: boolean;
}

export function BookingConfirmationModal({
  isOpen,
  isSuccess,
  errorMessage,
  bookingDetails,
  onClose,
  isGuest
}: BookingConfirmationModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleViewBookings = () => {
    onClose();
    navigate('/reviews');
  };

  const handleBrowseServices = () => {
    onClose();
    navigate('/services');
  };

  const handleTryAgain = () => {
    onClose();
  };

  if (isSuccess && bookingDetails) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto animate-in zoom-in duration-300">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-6 rounded-t-2xl">
            <div className="flex items-center justify-center mb-3">
              <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-white" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-center">Reserva Registada!</h2>
            <p className="text-green-100 text-center mt-2 text-sm">
              A sua reserva foi criada com sucesso
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 p-5">
              <div className="flex items-start mb-4">
                <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div className="ml-3 flex-1">
                  <h3 className="font-bold text-gray-900 text-lg">{bookingDetails.serviceName}</h3>
                  {bookingDetails.variantName && (
                    <p className="text-sm text-green-700 font-medium mt-1">
                      Opção: {bookingDetails.variantName}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-3 ml-13">
                <div className="flex items-center text-gray-700">
                  <User className="h-4 w-4 mr-3 text-green-600" />
                  <div>
                    <span className="text-xs text-gray-500 block">Profissional</span>
                    <span className="font-semibold">{bookingDetails.professionalName}</span>
                  </div>
                </div>

                <div className="flex items-center text-gray-700">
                  <Calendar className="h-4 w-4 mr-3 text-green-600" />
                  <div>
                    <span className="text-xs text-gray-500 block">Data</span>
                    <span className="font-semibold">
                      {format(new Date(bookingDetails.date), 'PPP', { locale: pt })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center text-gray-700">
                  <Clock className="h-4 w-4 mr-3 text-green-600" />
                  <div>
                    <span className="text-xs text-gray-500 block">Horário</span>
                    <span className="font-semibold">{bookingDetails.time}</span>
                  </div>
                </div>

                <div className="flex items-center text-gray-700">
                  <Clock className="h-4 w-4 mr-3 text-green-600" />
                  <div>
                    <span className="text-xs text-gray-500 block">Duração</span>
                    <span className="font-semibold">{bookingDetails.duration}</span>
                  </div>
                </div>

                <div className="flex items-center text-gray-700">
                  <Euro className="h-4 w-4 mr-3 text-green-600" />
                  <div>
                    <span className="text-xs text-gray-500 block">Preço</span>
                    <span className="font-semibold">{bookingDetails.price}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <div className="flex items-start">
                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-semibold text-blue-900 mb-1">
                    Aguarda Confirmação
                  </p>
                  <p className="text-xs text-blue-700">
                    A sua reserva está no estado <strong>pendente</strong>. O profissional será notificado e irá confirmar a sua disponibilidade em breve.
                  </p>
                </div>
              </div>
            </div>

            {isGuest && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4">
                <p className="text-sm text-amber-800">
                  <strong>Dica:</strong> Crie uma conta para gerir facilmente todas as suas reservas num só lugar!
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleBrowseServices}
                className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-2"
              >
                <Home className="h-4 w-4" />
                Ver Serviços
              </button>
              {!isGuest && (
                <button
                  onClick={handleViewBookings}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  Minhas Reservas
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[95vh] overflow-y-auto animate-in zoom-in duration-300">
        <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-6 rounded-t-2xl">
          <div className="flex items-center justify-center mb-3">
            <div className="h-16 w-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <XCircle className="h-10 w-10 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center">Erro ao Criar Reserva</h2>
          <p className="text-red-100 text-center mt-2 text-sm">
            Não foi possível registar a sua reserva
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
            <div className="flex items-start">
              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <p className="text-sm font-semibold text-red-900 mb-2">
                  Detalhes do Erro
                </p>
                <p className="text-sm text-red-700">
                  {errorMessage || 'Ocorreu um erro inesperado ao processar a sua reserva. Por favor, tente novamente.'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-800">
              <strong>Sugestões:</strong>
            </p>
            <ul className="text-xs text-blue-700 mt-2 space-y-1 ml-4 list-disc">
              <li>Verifique se o horário selecionado ainda está disponível</li>
              <li>Confirme se todos os campos obrigatórios foram preenchidos</li>
              <li>Tente escolher outro horário ou profissional</li>
              <li>Se o problema persistir, contacte o suporte</li>
            </ul>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleTryAgain}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white font-semibold rounded-lg hover:from-red-700 hover:to-orange-700 transition-all shadow-lg"
            >
              Tentar Novamente
            </button>
            <button
              onClick={handleBrowseServices}
              className="flex-1 px-6 py-3 border-2 border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all"
            >
              Voltar aos Serviços
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
