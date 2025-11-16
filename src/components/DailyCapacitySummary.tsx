import { Users, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

interface DailyCapacitySummaryProps {
  totalCapacity: number;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  fullyBookedSlots: number;
  occupationPercentage: number;
  loading?: boolean;
}

export function DailyCapacitySummary({
  totalCapacity,
  totalSlots,
  availableSlots,
  occupiedSlots,
  fullyBookedSlots,
  occupationPercentage,
  loading = false
}: DailyCapacitySummaryProps) {
  const getOccupationColor = () => {
    if (occupationPercentage >= 80) return 'text-red-600';
    if (occupationPercentage >= 50) return 'text-orange-600';
    if (occupationPercentage >= 30) return 'text-amber-600';
    return 'text-green-600';
  };

  const getOccupationBgColor = () => {
    if (occupationPercentage >= 80) return 'bg-red-500';
    if (occupationPercentage >= 50) return 'bg-orange-500';
    if (occupationPercentage >= 30) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getOccupationLabel = () => {
    if (occupationPercentage >= 80) return 'Alta ocupação';
    if (occupationPercentage >= 50) return 'Média ocupação';
    if (occupationPercentage >= 30) return 'Baixa ocupação';
    return 'Muito disponível';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl border-2 border-gray-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Capacidade do Dia</h3>
            <p className="text-sm text-gray-600">
              Equipa de {totalCapacity} {totalCapacity === 1 ? 'profissional' : 'profissionais'}
            </p>
          </div>
        </div>
        <div className={`text-right ${getOccupationColor()}`}>
          <div className="text-3xl font-black">{occupationPercentage.toFixed(0)}%</div>
          <div className="text-xs font-semibold uppercase tracking-wide">{getOccupationLabel()}</div>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-gray-600 font-medium">Ocupação dos Horários</span>
          <span className="text-gray-900 font-bold">
            {fullyBookedSlots} de {totalSlots} esgotados
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
          <div
            className={`h-full ${getOccupationBgColor()} transition-all duration-500 ease-out rounded-full`}
            style={{ width: `${occupationPercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <div className="flex items-center space-x-2 mb-1">
            <Calendar className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-700 font-semibold uppercase">Disponíveis</span>
          </div>
          <div className="text-2xl font-black text-green-900">{availableSlots}</div>
          <div className="text-xs text-green-600">
            {((availableSlots / totalSlots) * 100).toFixed(0)}% do total
          </div>
        </div>

        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <div className="flex items-center space-x-2 mb-1">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-amber-700 font-semibold uppercase">Parciais</span>
          </div>
          <div className="text-2xl font-black text-amber-900">{occupiedSlots}</div>
          <div className="text-xs text-amber-600">
            Alguns ocupados
          </div>
        </div>

        <div className="bg-red-50 rounded-lg p-3 border border-red-200">
          <div className="flex items-center space-x-2 mb-1">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs text-red-700 font-semibold uppercase">Esgotados</span>
          </div>
          <div className="text-2xl font-black text-red-900">{fullyBookedSlots}</div>
          <div className="text-xs text-red-600">
            {((fullyBookedSlots / totalSlots) * 100).toFixed(0)}% do total
          </div>
        </div>
      </div>

      <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-1">Sistema de Bloqueio Inteligente</p>
            <p>
              Horários ficam <strong>esgotados</strong> quando todos os {totalCapacity}{' '}
              {totalCapacity === 1 ? 'profissional está ocupado' : 'profissionais estão ocupados'}.
              Apenas reservas <strong>confirmadas</strong> bloqueiam vagas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
