import { formatCurrency } from './currency';
import { ServiceVariant } from '../types/service';

interface WhatsAppMessageParams {
  serviceTitle: string;
  servicePrice?: number;
  serviceDuration?: string;
  businessName: string;
  variant?: ServiceVariant;
}

export function formatWhatsAppMessage(params: WhatsAppMessageParams): string {
  const { serviceTitle, servicePrice, serviceDuration, businessName, variant } = params;

  if (variant) {
    return `Olá! Tenho interesse em agendar o serviço:\n\n*${serviceTitle}*\nOpção: ${variant.name}\nDuração: ${variant.duration}\nPreço: ${formatCurrency(variant.price)}\n\nEstabelecimento: ${businessName}\n\nQual seria o melhor horário?`;
  }

  const priceText = servicePrice !== undefined ? `\nPreço: ${formatCurrency(servicePrice)}` : '';
  const durationText = serviceDuration ? `\nDuração: ${serviceDuration}` : '';

  return `Olá! Tenho interesse em agendar o serviço:\n\n*${serviceTitle}*${durationText}${priceText}\n\nEstabelecimento: ${businessName}\n\nQual seria o melhor horário?`;
}

export function openWhatsApp(phoneNumber: string, message: string): void {
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

export function handleWhatsAppClick(
  phoneNumber: string,
  params: WhatsAppMessageParams
): void {
  if (!phoneNumber) {
    console.warn('WhatsApp number not available');
    return;
  }

  const message = formatWhatsAppMessage(params);
  openWhatsApp(phoneNumber, message);
}
