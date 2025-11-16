import { Users, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ProfessionalInfo } from '../hooks/useProfessionalAvailability';

interface ProfessionalCountBadgeProps {
  availableCount: number;
  totalCapacity: number;
  availableProfessionals?: ProfessionalInfo[];
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showNames?: boolean;
  variant?: 'default' | 'compact' | 'detailed';
  className?: string;
}

export function ProfessionalCountBadge({
  availableCount,
  totalCapacity,
  availableProfessionals = [],
  size = 'md',
  showLabel = false,
  showNames = false,
  variant = 'default',
  className = ''
}: ProfessionalCountBadgeProps) {
  const getColorClasses = () => {
    const utilizationPercentage = totalCapacity > 0
      ? ((totalCapacity - availableCount) / totalCapacity) * 100
      : 0;

    if (availableCount === 0) {
      return {
        bg: 'bg-red-100',
        text: 'text-red-700',
        border: 'border-red-300',
        icon: 'text-red-600'
      };
    }

    if (utilizationPercentage >= 75) {
      return {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        border: 'border-orange-300',
        icon: 'text-orange-600'
      };
    }

    if (utilizationPercentage >= 50) {
      return {
        bg: 'bg-amber-100',
        text: 'text-amber-700',
        border: 'border-amber-300',
        icon: 'text-amber-600'
      };
    }

    return {
      bg: 'bg-green-100',
      text: 'text-green-700',
      border: 'border-green-300',
      icon: 'text-green-600'
    };
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          container: 'px-2 py-0.5 text-xs',
          icon: 'h-3 w-3',
          gap: 'gap-1'
        };
      case 'lg':
        return {
          container: 'px-4 py-2 text-base',
          icon: 'h-5 w-5',
          gap: 'gap-2'
        };
      default:
        return {
          container: 'px-2.5 py-1 text-sm',
          icon: 'h-4 w-4',
          gap: 'gap-1.5'
        };
    }
  };

  const colors = getColorClasses();
  const sizes = getSizeClasses();

  const getIcon = () => {
    if (availableCount === 0) {
      return <AlertCircle className={sizes.icon} />;
    }
    if (availableCount === 1) {
      return <User className={sizes.icon} />;
    }
    if (availableCount === totalCapacity) {
      return <CheckCircle2 className={sizes.icon} />;
    }
    return <Users className={sizes.icon} />;
  };

  const getDisplayText = () => {
    if (variant === 'compact') {
      return `${availableCount}/${totalCapacity}`;
    }

    if (showNames && availableProfessionals.length > 0) {
      if (availableCount === 1) {
        return `${availableProfessionals[0].name} disponível`;
      }
      if (availableCount === 2) {
        return `${availableProfessionals[0].name} e ${availableProfessionals[1].name}`;
      }
      if (availableCount === 3) {
        const names = availableProfessionals.slice(0, 2).map(p => p.name).join(', ');
        return `${names} e mais 1`;
      }
    }

    if (availableCount === 0) {
      return 'Esgotado';
    }

    if (availableCount === 1) {
      return showLabel ? '1 disponível' : '1';
    }

    const label = showLabel ? 'disponíveis' : '';
    return `${availableCount} ${label}`.trim();
  };

  const tooltipText = availableProfessionals.length > 0
    ? `Disponíveis: ${availableProfessionals.map(p => p.name).join(', ')}`
    : `${availableCount} de ${totalCapacity} ${availableCount === 1 ? 'profissional disponível' : 'profissionais disponíveis'}`;

  if (variant === 'detailed') {
    return (
      <div
        className={`${colors.bg} ${colors.text} rounded-lg p-3 border ${colors.border} ${className}`}
        title={tooltipText}
      >
        <div className="flex items-center justify-between mb-2">
          <div className={`flex items-center ${sizes.gap}`}>
            <span className={colors.icon}>{getIcon()}</span>
            <span className="font-bold">{availableCount}/{totalCapacity}</span>
          </div>
          {showLabel && (
            <span className="text-xs opacity-75">
              {availableCount === 0 ? 'Esgotado' : 'Disponíveis'}
            </span>
          )}
        </div>
        {showNames && availableProfessionals.length > 0 && (
          <div className="mt-2 space-y-1">
            {availableProfessionals.slice(0, 3).map((pro, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                {pro.photo_url ? (
                  <img
                    src={pro.photo_url}
                    alt={pro.name}
                    className="h-5 w-5 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="h-3 w-3 text-gray-500" />
                  </div>
                )}
                <span className="truncate">{pro.name}</span>
              </div>
            ))}
            {availableProfessionals.length > 3 && (
              <div className="text-xs opacity-75 mt-1">
                +{availableProfessionals.length - 3} mais
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center ${sizes.gap} ${colors.bg} ${colors.text} ${sizes.container} rounded-full font-bold border ${colors.border} transition-all ${className}`}
      title={tooltipText}
    >
      <span className={colors.icon}>{getIcon()}</span>
      <span>{getDisplayText()}</span>
    </div>
  );
}
