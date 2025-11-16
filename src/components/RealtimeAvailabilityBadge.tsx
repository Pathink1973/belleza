import { Users, Clock, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { useRealtimeAvailability } from '../hooks/useRealtimeAvailability';
import { useEffect, useState } from 'react';

interface RealtimeAvailabilityBadgeProps {
  serviceId: string;
  date?: Date;
  compact?: boolean;
  showStats?: boolean;
}

export function RealtimeAvailabilityBadge({
  serviceId,
  date = new Date(),
  compact = false,
  showStats = false
}: RealtimeAvailabilityBadgeProps) {
  const { dailyStats, loading, lastUpdate, dailyMatrix } = useRealtimeAvailability({
    serviceId,
    date,
    autoRefresh: true,
    refreshInterval: 30000
  });

  const [pulseAnimation, setPulseAnimation] = useState(false);

  useEffect(() => {
    if (lastUpdate) {
      setPulseAnimation(true);
      const timer = setTimeout(() => setPulseAnimation(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate]);

  if (loading && dailyMatrix.length === 0) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 rounded-full">
        <div className="animate-spin h-3 w-3 border-2 border-gray-400 border-t-transparent rounded-full" />
        <span className="text-xs text-gray-600">A carregar...</span>
      </div>
    );
  }

  const getColorClasses = () => {
    const hasAnyAvailability = dailyMatrix.some(slot => slot.available_count > 0);

    if (!hasAnyAvailability) {
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        ring: 'ring-red-300',
        icon: 'text-red-600'
      };
    }

    return {
      bg: 'bg-green-100',
      text: 'text-green-700',
      ring: 'ring-green-300',
      icon: 'text-green-600'
    };
  };

  const colors = getColorClasses();

  if (compact) {
    return (
      <div
        className={`
          inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold
          ${colors.bg} ${colors.text} ring-1 ${colors.ring}
          ${pulseAnimation ? 'animate-pulse' : ''}
          transition-all duration-300
        `}
        title={`${dailyStats.availableSlots} vagas disponíveis de ${dailyStats.totalSlots}`}
      >
        <Users className={`h-3 w-3 ${colors.icon}`} />
        <span>Vagas: {dailyStats.availableSlots}/{dailyStats.totalSlots}</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border-2 ${colors.ring} ${colors.bg} p-4 ${pulseAnimation ? 'animate-pulse' : ''} transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className={`p-2 ${colors.bg} rounded-lg ring-2 ${colors.ring}`}>
            <Activity className={`h-5 w-5 ${colors.icon}`} />
          </div>
          <div>
            <h3 className={`text-sm font-bold ${colors.text}`}>Disponibilidade em Tempo Real</h3>
            {lastUpdate && (
              <p className="text-xs text-gray-500">
                Atualizado há {Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white bg-opacity-60 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            <Users className={`h-4 w-4 ${colors.icon}`} />
            <span className="text-xs font-medium text-gray-600">Vagas Disponíveis</span>
          </div>
          <div className={`text-2xl font-bold ${colors.text}`}>
            {dailyStats.availableSlots}
          </div>
          <div className="text-xs text-gray-500">
            de {dailyStats.totalSlots} totais
          </div>
        </div>

        <div className="bg-white bg-opacity-60 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-1">
            {dailyStats.availableSlots <= dailyStats.totalSlots / 2 ? (
              <TrendingUp className={`h-4 w-4 ${colors.icon}`} />
            ) : (
              <TrendingDown className={`h-4 w-4 ${colors.icon}`} />
            )}
            <span className="text-xs font-medium text-gray-600">Ocupação</span>
          </div>
          <div className={`text-2xl font-bold ${colors.text}`}>
            {Math.round(dailyStats.averageOccupancy)}%
          </div>
          <div className="text-xs text-gray-500">
            {dailyStats.occupiedSlots} vagas reservadas
          </div>
        </div>
      </div>

      {showStats && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Atualização automática a cada 30s</span>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${dailyStats.availableSlots > 0 ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className={colors.text}>
                {dailyStats.availableSlots > 0 ? `${dailyStats.availableSlots} vaga${dailyStats.availableSlots !== 1 ? 's' : ''}` : 'Esgotado'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
