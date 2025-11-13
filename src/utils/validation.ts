import { z } from 'zod';

// Service validation schema
export const serviceSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  duration: z.string(),
  whatsapp_number: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid WhatsApp number'),
  category: z.enum([
    'Cabelo e penteado',
    'Unhas',
    'Sobrancelhas',
    'Massagem',
    'Barbearia',
    'Depilação',
    'Tratamento Facial',
    'Tratamento Corporal',
    'Injectáveis',
    'Tatuagem e piercing',
    'Maquilhagem',
    'Fitness'
  ])
});

// Profile validation schema
export const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['client', 'professional', 'admin']),
  avatar_url: z.string().url().optional().nullable()
});

// Booking validation schema
export const bookingSchema = z.object({
  service_id: z.string().uuid(),
  professional_id: z.string().uuid(),
  client_id: z.string().uuid(),
  start_time: z.date(),
  end_time: z.date(),
  status: z.enum(['pendente', 'confirmado', 'concluído', 'cancelado'])
}).refine(data => data.end_time > data.start_time, {
  message: 'End time must be after start time',
  path: ['end_time']
});