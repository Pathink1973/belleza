export interface ServiceVariant {
  id: string;
  service_id: string;
  name: string;
  price: number;
  duration: string;
  display_order: number;
  created_at?: string;
}

export interface ServiceProfessional {
  id: string;
  service_id: string;
  profile_id: string;
  is_primary: boolean;
  created_at: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
    email: string;
    business_name: string | null;
    business_description: string | null;
    business_address: string | null;
    business_phone: string | null;
  };
}

export interface Service {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  professional_id: string;
  images: string[];
  whatsapp_number: string;
  category: string;
  team: Array<{
    id: string;
    profile_id?: string;
    name: string;
    imageUrl: string;
  }>;
  variants?: ServiceVariant[];
  service_professionals?: ServiceProfessional[];
  professional?: {
    full_name: string;
    avatar_url: string | null;
    business_name: string | null;
    business_description: string | null;
    business_address: string | null;
    business_phone: string | null;
  };
  reviews?: {
    rating: number;
  }[] | null;
  average_rating?: number | null;
  created_at?: string;
}

export interface ServiceVariantFormData {
  id: string;
  name: string;
  price: string;
  duration: string;
  display_order: number;
}
