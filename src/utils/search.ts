import { supabase } from '../lib/supabase';

export interface SearchFilters {
  search?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  minRating?: number;
  duration?: string;
  professionalId?: string;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest';
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  price: number;
  duration: string;
  category: string;
  images: string[];
  whatsapp_number: string;
  team: any[];
  professional_id: string;
  created_at: string;
  professional: {
    full_name: string;
    avatar_url: string | null;
    business_name: string | null;
    business_address: string | null;
    business_phone: string | null;
  };
  average_rating: number;
  review_count: number;
  relevance_score?: number;
}

export async function searchServices(filters: SearchFilters): Promise<SearchResult[]> {
  try {
    const {
      search,
      location,
      minPrice,
      maxPrice,
      category,
      minRating,
      professionalId,
      sortBy = 'relevance'
    } = filters;

    let query = supabase
      .from('services')
      .select(`
        *,
        professional:profiles!services_professional_id_fkey(
          full_name,
          avatar_url,
          business_name,
          business_address,
          business_phone
        ),
        reviews:reviews(rating)
      `);

    if (professionalId) {
      query = query.eq('professional_id', professionalId);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,category.ilike.%${search}%`);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (minPrice !== undefined && minPrice !== null) {
      query = query.gte('price', minPrice);
    }

    if (maxPrice !== undefined && maxPrice !== null) {
      query = query.lte('price', maxPrice);
    }

    if (filters.duration) {
      query = query.eq('duration', filters.duration);
    }

    const { data: servicesData, error } = await query;

    if (error) {
      console.error('Error searching services:', error);
      throw error;
    }

    if (!servicesData) return [];

    let services = servicesData.map(service => ({
      ...service,
      average_rating: service.reviews && service.reviews.length > 0
        ? service.reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0) / service.reviews.length
        : 0,
      review_count: service.reviews?.length || 0
    }));

    if (location && location.trim()) {
      services = services.filter(service =>
        service.professional?.business_address?.toLowerCase().includes(location.toLowerCase())
      );
    }

    if (minRating !== undefined && minRating !== null) {
      services = services.filter(service => service.average_rating >= minRating);
    }

    services = services.map(service => ({
      ...service,
      relevance_score: calculateRelevanceScore(service, search, location)
    }));

    switch (sortBy) {
      case 'relevance':
        services.sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
        break;
      case 'price_asc':
        services.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        services.sort((a, b) => b.price - a.price);
        break;
      case 'rating_desc':
        services.sort((a, b) => b.average_rating - a.average_rating);
        break;
      case 'newest':
        services.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    return services;
  } catch (error) {
    console.error('Error in searchServices:', error);
    return [];
  }
}

function calculateRelevanceScore(
  service: any,
  searchText?: string,
  userLocation?: string
): number {
  let textScore = 0;
  let locationScore = 0;
  let ratingScore = 0;
  let recencyScore = 0;
  let featuredBonus = 0;

  const lowerSearch = searchText?.toLowerCase() || '';
  const lowerLocation = userLocation?.toLowerCase() || '';

  if (service.is_featured) {
    featuredBonus = 15 + (service.featured_priority || 0) * 0.5;
  }

  if (searchText) {
    if (service.title?.toLowerCase() === lowerSearch) {
      textScore = 40;
    } else if (service.title?.toLowerCase().includes(lowerSearch)) {
      textScore = 30;
    } else if (service.description?.toLowerCase().includes(lowerSearch)) {
      textScore = 20;
    } else if (service.category?.toLowerCase().includes(lowerSearch)) {
      textScore = 15;
    } else if (
      service.professional?.business_name?.toLowerCase().includes(lowerSearch) ||
      service.professional?.full_name?.toLowerCase().includes(lowerSearch)
    ) {
      textScore = 10;
    }
  } else {
    textScore = 20;
  }

  if (userLocation && service.professional?.business_address) {
    const address = service.professional.business_address.toLowerCase();
    if (address.includes(lowerLocation)) {
      locationScore = 25;
    }
  } else {
    locationScore = 10;
  }

  if (service.average_rating > 0) {
    ratingScore = (service.average_rating / 5.0) * 20;
    if (service.review_count > 0) {
      ratingScore += Math.min(service.review_count, 5);
    }
  } else {
    ratingScore = 10;
  }

  const daysOld = (Date.now() - new Date(service.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysOld <= 7) {
    recencyScore = 10;
  } else if (daysOld <= 30) {
    recencyScore = 7;
  } else if (daysOld <= 90) {
    recencyScore = 5;
  } else {
    recencyScore = 3;
  }

  return textScore + locationScore + ratingScore + recencyScore + featuredBonus;
}

export async function getUniqueLocations(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('business_address')
      .not('business_address', 'is', null)
      .eq('role', 'professional');

    if (error) throw error;

    const locations = new Set<string>();
    data?.forEach(profile => {
      if (profile.business_address) {
        const parts = profile.business_address.split(',').map(p => p.trim());
        parts.forEach(part => {
          if (part.length > 2) {
            locations.add(part);
          }
        });
      }
    });

    return Array.from(locations).sort();
  } catch (error) {
    console.error('Error fetching locations:', error);
    return [];
  }
}

export async function getPopularSearches(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('category')
      .not('category', 'is', null);

    if (error) throw error;

    const categoryCounts = new Map<string, number>();
    data?.forEach(service => {
      if (service.category) {
        categoryCounts.set(service.category, (categoryCounts.get(service.category) || 0) + 1);
      }
    });

    return Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([category]) => category);
  } catch (error) {
    console.error('Error fetching popular searches:', error);
    return [];
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
