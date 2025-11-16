import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface ProfessionalInfo {
  id: string;
  name: string;
  photo_url: string | null;
  is_primary: boolean;
  team_member_id?: string | null;
}

export interface SlotProfessionalAvailability {
  total_capacity: number;
  available_count: number;
  occupied_count: number;
  is_available: boolean;
  available_professionals: ProfessionalInfo[];
  occupied_professionals: ProfessionalInfo[];
  blocked_reason: string | null;
}

interface UseProfessionalAvailabilityOptions {
  enableRealtime?: boolean;
  pollingInterval?: number;
  autoRefresh?: boolean;
}

export function useProfessionalAvailability(
  serviceId: string | null,
  date: Date,
  startTime: string,
  endTime: string,
  options: UseProfessionalAvailabilityOptions = {}
) {
  const {
    enableRealtime = true,
    pollingInterval = 30000,
    autoRefresh = true
  } = options;

  const [availability, setAvailability] = useState<SlotProfessionalAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const fetchAvailability = useCallback(async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const dateStr = date.toISOString().split('T')[0];

      const { data, error: rpcError } = await supabase.rpc(
        'get_professionals_availability_for_slot',
        {
          p_service_id: serviceId,
          p_date: dateStr,
          p_start_time: startTime,
          p_end_time: endTime
        }
      );

      if (rpcError) {
        console.error('[PROFESSIONAL_AVAILABILITY] Error fetching:', rpcError);
        throw rpcError;
      }

      if (data && data.length > 0) {
        const result = data[0];
        setAvailability({
          total_capacity: result.total_capacity,
          available_count: result.available_count,
          occupied_count: result.occupied_count,
          is_available: result.is_available,
          available_professionals: result.available_professionals || [],
          occupied_professionals: result.occupied_professionals || [],
          blocked_reason: result.blocked_reason
        });
      } else {
        setAvailability(null);
      }
    } catch (err: any) {
      console.error('[PROFESSIONAL_AVAILABILITY] Fetch error:', err);
      setError(err.message || 'Erro ao carregar disponibilidade');
    } finally {
      setLoading(false);
    }
  }, [serviceId, date, startTime, endTime]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  useEffect(() => {
    if (!autoRefresh || !serviceId) return;

    const startPolling = () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }

      pollingTimeoutRef.current = setTimeout(() => {
        fetchAvailability();
        startPolling();
      }, pollingInterval);
    };

    startPolling();

    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, [autoRefresh, pollingInterval, fetchAvailability, serviceId]);

  useEffect(() => {
    if (!enableRealtime || !serviceId) return;

    const dateStr = date.toISOString().split('T')[0];
    const channelName = `availability_${serviceId}_${dateStr}`;

    console.log('[REALTIME] Subscribing to channel:', channelName);

    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `service_id=eq.${serviceId}`
        },
        (payload) => {
          console.log('[REALTIME] Booking change detected:', payload);
          fetchAvailability();
        }
      )
      .subscribe((status) => {
        console.log('[REALTIME] Subscription status:', status);
      });

    return () => {
      if (channelRef.current) {
        console.log('[REALTIME] Unsubscribing from channel:', channelName);
        channelRef.current.unsubscribe();
      }
    };
  }, [enableRealtime, serviceId, date, fetchAvailability]);

  return {
    availability,
    loading,
    error,
    refetch: fetchAvailability
  };
}
