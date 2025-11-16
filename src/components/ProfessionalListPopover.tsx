import { useState } from 'react';
import { Users, User, X, CheckCircle2, XCircle } from 'lucide-react';
import { ProfessionalInfo } from '../hooks/useProfessionalAvailability';

interface ProfessionalListPopoverProps {
  availableProfessionals: ProfessionalInfo[];
  occupiedProfessionals: ProfessionalInfo[];
  totalCapacity: number;
  trigger?: React.ReactNode;
}

export function ProfessionalListPopover({
  availableProfessionals,
  occupiedProfessionals,
  totalCapacity,
  trigger
}: ProfessionalListPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const defaultTrigger = (
    <button
      onClick={() => setIsOpen(!isOpen)}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
    >
      <Users className="h-4 w-4" />
      <span>Ver profissionais</span>
    </button>
  );

  return (
    <div className="relative">
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger || defaultTrigger}
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-50 mt-2 w-80 bg-white rounded-xl shadow-2xl border-2 border-gray-200 overflow-hidden right-0">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">Profissionais</h3>
                    <p className="text-xs text-gray-600">
                      {availableProfessionals.length} de {totalCapacity} disponíveis
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {availableProfessionals.length > 0 && (
                <div className="p-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <h4 className="text-sm font-semibold text-gray-900">
                      Disponíveis ({availableProfessionals.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {availableProfessionals.map((pro, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2 bg-green-50 border border-green-200 rounded-lg"
                      >
                        {pro.photo_url ? (
                          <img
                            src={pro.photo_url}
                            alt={pro.name}
                            className="h-10 w-10 rounded-full object-cover ring-2 ring-green-300"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-green-200 flex items-center justify-center ring-2 ring-green-300">
                            <User className="h-5 w-5 text-green-700" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {pro.name}
                          </p>
                          {pro.is_primary && (
                            <p className="text-xs text-green-600 font-medium">
                              Profissional Principal
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {occupiedProfessionals.length > 0 && (
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <h4 className="text-sm font-semibold text-gray-900">
                      Ocupados ({occupiedProfessionals.length})
                    </h4>
                  </div>
                  <div className="space-y-2">
                    {occupiedProfessionals.map((pro, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-2 bg-gray-50 border border-gray-200 rounded-lg opacity-75"
                      >
                        {pro.photo_url ? (
                          <img
                            src={pro.photo_url}
                            alt={pro.name}
                            className="h-10 w-10 rounded-full object-cover grayscale"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-700 truncate">
                            {pro.name}
                          </p>
                          <p className="text-xs text-red-600 font-medium">
                            Ocupado
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {availableProfessionals.length === 0 && occupiedProfessionals.length === 0 && (
                <div className="p-8 text-center">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    Nenhum profissional encontrado
                  </p>
                </div>
              )}
            </div>

            {availableProfessionals.length === 0 && occupiedProfessionals.length > 0 && (
              <div className="bg-red-50 border-t border-red-200 px-4 py-3">
                <p className="text-xs text-red-800 font-medium text-center">
                  Todos os profissionais estão ocupados neste horário
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
