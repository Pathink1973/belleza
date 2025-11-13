import { format, formatDistance, formatRelative, isToday, isYesterday, isTomorrow } from 'date-fns';
import { ptLocale } from '../i18n';

/**
 * Formats a date relative to now with smart display
 */
export function formatSmartDate(date: Date | string, locale: string = 'pt'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isToday(dateObj)) {
    return 'Hoje ' + format(dateObj, 'HH:mm');
  }
  
  if (isYesterday(dateObj)) {
    return 'Ontem ' + format(dateObj, 'HH:mm');
  }
  
  if (isTomorrow(dateObj)) {
    return 'Amanhã ' + format(dateObj, 'HH:mm');
  }
  
  return format(dateObj, 'PPp', {
    locale: locale === 'pt' ? ptLocale : undefined
  });
}

/**
 * Formats a duration in minutes to a human-readable string
 */
export function formatDuration(minutes: number, locale: string = 'pt'): string {
  if (minutes < 60) {
    return `${minutes} ${locale === 'pt' ? 'minutos' : 'minutes'}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} ${locale === 'pt' ? (hours === 1 ? 'hora' : 'horas') : (hours === 1 ? 'hour' : 'hours')}`;
  }
  
  return locale === 'pt'
    ? `${hours} ${hours === 1 ? 'hora' : 'horas'} e ${remainingMinutes} minutos`
    : `${hours} ${hours === 1 ? 'hour' : 'hours'} and ${remainingMinutes} minutes`;
}

/**
 * Gets relative time from now
 */
export function getRelativeTime(date: Date | string, locale: string = 'pt'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatDistance(dateObj, new Date(), {
    addSuffix: true,
    locale: locale === 'pt' ? ptLocale : undefined
  });
}

/**
 * Formats a date relative to a base date
 */
export function getRelativeDate(date: Date | string, baseDate: Date | string, locale: string = 'pt'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const baseDateObj = typeof baseDate === 'string' ? new Date(baseDate) : baseDate;

  return formatRelative(dateObj, baseDateObj, {
    locale: locale === 'pt' ? ptLocale : undefined
  });
}

/**
 * Converts PostgreSQL interval or duration string to minutes
 * Supports formats: "HH:MM:SS", "60 minutos", "1 hora", "1:30:00"
 */
export function parseDurationToMinutes(duration: string): number {
  if (!duration) return 0;

  // Handle PostgreSQL interval format (HH:MM:SS)
  if (duration.includes(':')) {
    const parts = duration.split(':');
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    return hours * 60 + minutes;
  }

  // Handle "60 minutos", "1 hora", etc.
  const minutesMatch = duration.match(/(\d+)\s*(minuto|minute)/i);
  if (minutesMatch) {
    return parseInt(minutesMatch[1]);
  }

  const hoursMatch = duration.match(/(\d+)\s*(hora|hour)/i);
  if (hoursMatch) {
    return parseInt(hoursMatch[1]) * 60;
  }

  // Fallback: try to parse as plain number
  const parsed = parseInt(duration);
  return isNaN(parsed) ? 0 : parsed;
}