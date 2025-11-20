import { ReactNode, useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface InfoCardProps {
  children: ReactNode;
  variant?: 'default' | 'subtle' | 'minimal';
  dismissible?: boolean;
  storageKey?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  className?: string;
}

export function InfoCard({
  children,
  variant = 'subtle',
  dismissible = false,
  storageKey,
  collapsible = false,
  defaultCollapsed = false,
  className = ''
}: InfoCardProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    if (dismissible && storageKey) {
      const dismissed = localStorage.getItem(storageKey);
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    }
  }, [dismissible, storageKey]);

  const handleDismiss = () => {
    if (storageKey) {
      localStorage.setItem(storageKey, 'true');
    }
    setIsDismissed(true);
  };

  if (isDismissed) {
    return null;
  }

  const variantStyles = {
    default: 'bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200',
    subtle: 'bg-white/80 backdrop-blur-sm border border-gray-200/60 shadow-sm',
    minimal: 'bg-transparent border-l-2 border-blue-400'
  };

  return (
    <div className={`relative rounded-lg ${variantStyles[variant]} ${className} transition-all duration-300`}>
      <div className="relative">
        {dismissible && (
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {collapsible && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="absolute top-2 right-8 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
            aria-label={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        )}

        <div className={`transition-all duration-300 ${isCollapsed ? 'max-h-16 overflow-hidden' : 'max-h-[1000px]'}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface InfoCardHeaderProps {
  children: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  color?: 'blue' | 'green' | 'emerald' | 'amber' | 'red';
  className?: string;
}

InfoCard.Header = function InfoCardHeader({ children, icon: Icon, color = 'blue', className = '' }: InfoCardHeaderProps) {
  const colorStyles = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-red-700'
  };

  return (
    <div className={`flex items-center space-x-2 mb-2 ${className}`}>
      {Icon && <Icon className={`h-4 w-4 ${colorStyles[color]} flex-shrink-0`} />}
      <h3 className={`text-sm font-semibold ${colorStyles[color]}`}>{children}</h3>
    </div>
  );
};

interface InfoCardContentProps {
  children: ReactNode;
  className?: string;
}

InfoCard.Content = function InfoCardContent({ children, className = '' }: InfoCardContentProps) {
  return (
    <div className={`text-xs text-gray-600 leading-relaxed ${className}`}>
      {children}
    </div>
  );
};

interface InfoCardTooltipProps {
  content: string;
  children: ReactNode;
}

InfoCard.Tooltip = function InfoCardTooltip({ content, children }: InfoCardTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-50 animate-in fade-in duration-200">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
};

interface InfoCardActionsProps {
  children: ReactNode;
  className?: string;
}

InfoCard.Actions = function InfoCardActions({ children, className = '' }: InfoCardActionsProps) {
  return (
    <div className={`flex items-center space-x-2 mt-2 ${className}`}>
      {children}
    </div>
  );
};
