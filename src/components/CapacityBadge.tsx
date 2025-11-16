import { Users, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface CapacityBadgeProps {
  availableCount: number;
  totalCapacity: number;
  isAvailable: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  blockedReason?: string;
}

export function CapacityBadge({
  availableCount,
  totalCapacity,
  isAvailable,
  size = 'md',
  showLabel = false,
  blockedReason
}: CapacityBadgeProps) {
  const availabilityPercentage = totalCapacity > 0
    ? (availableCount / totalCapacity) * 100
    : 0;

  const getColorClasses = () => {
    if (availableCount === 0) {
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

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-0.5',
          text: 'text-xs',
          icon: 'h-3 w-3'
        };
      case 'lg':
        return {
          container: 'px-4 py-2',
          text: 'text-base',
          icon: 'h-5 w-5'
        };
      default:
        return {
          container: 'px-2.5 py-1',
          text: 'text-sm',
          icon: 'h-4 w-4'
        };
    }
  };

  const colors = getColorClasses();
  const sizes = getSizeClasses();

  const getIcon = () => {
    if (availableCount === 0) {
      return <XCircle className={sizes.icon} />;
    }

    if (availabilityPercentage <= 50) {
      return <AlertTriangle className={sizes.icon} />;
    }

    return <CheckCircle2 className={sizes.icon} />;
  };

  const getLabel = () => {
    if (availableCount === 0) {
      if (blockedReason) {
        return blockedReason;
      }
      return 'Esgotado';
    }

    if (showLabel) {
      if (availableCount === totalCapacity) {
        return 'Todos livres';
      }
      if (availableCount === 1) {
        return 'Última vaga';
      }
      if (availabilityPercentage <= 50) {
        return 'Poucas vagas';
      }
      return 'Disponível';
    }

    return null;
  };

  const tooltipText = availableCount > 0
    ? `${availableCount} de ${totalCapacity} ${availableCount === 1 ? 'vaga disponível' : 'vagas disponíveis'}`
    : blockedReason || `Esgotado - 0 de ${totalCapacity} ${totalCapacity === 1 ? 'vaga disponível' : 'vagas disponíveis'}`;

  return (
    <div
      className={`inline-flex items-center space-x-1 ${colors.bg} ${colors.text} ${sizes.container} rounded-full font-bold ring-1 ${colors.ring} transition-all`}
      title={tooltipText}
    >
      <span className={colors.icon}>
        {getIcon()}
      </span>
      <span className={sizes.text}>
        {availableCount}/{totalCapacity}
      </span>
      {showLabel && getLabel() && (
        <span className={`${sizes.text} ml-1`}>
          · {getLabel()}
        </span>
      )}
    </div>
  );
}
