import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

export interface MatrixSlot {
  time_slot: string;
  available_count: number;
  total_capacity: number;
  is_available: boolean;
  utilization_percentage: number;
}

interface UseAvailabilityMatrixOptions {
  enableRealtime?: boolean;
  pollingInterval?: number;
}

export function useAvailabilityMatrix(
  serviceId: string | null,
  date: Date,
  options: UseAvailabilityMatrixOptions = {}
) {
  const {
    enableRealtime = true,
    pollingInterval = 60000
  } = options;

  const [matrix, setMatrix] = useState<Map<string, MatrixSlot>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  const fetchMatrix = useCallback(async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const dateStr = date.toISOString().split('T')[0];

      const { data, error: rpcError } = await supabase.rpc(
        'get_service_team_availability_matrix',
        {
          p_service_id: serviceId,
          p_date: dateStr
        }
      );

      if (rpcError) {
        console.error('[AVAILABILITY_MATRIX] Error fetching:', rpcError);
        throw rpcError;
      }

      if (data) {
        const newMatrix = new Map<string, MatrixSlot>();
        data.forEach((slot: any) => {
          newMatrix.set(slot.time_slot, {
            time_slot: slot.time_slot,
            available_count: slot.available_count,
            total_capacity: slot.total_capacity,
            is_available: slot.is_available,
            utilization_percentage: slot.utilization_percentage
          });
        });
        setMatrix(newMatrix);
      }
    } catch (err: any) {
      console.error('[AVAILABILITY_MATRIX] Fetch error:', err);
      setError(err.message || 'Erro ao carregar matriz de disponibilidade');
    } finally {
      setLoading(false);
    }
  }, [serviceId, date]);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  useEffect(() => {
    if (!serviceId) return;

    const startPolling = () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }

      pollingTimeoutRef.current = setTimeout(() => {
        fetchMatrix();
        startPolling();
      }, pollingInterval);
    };

    startPolling();

    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
    };
  }, [pollingInterval, fetchMatrix, serviceId]);

  useEffect(() => {
    if (!enableRealtime || !serviceId) return;

    const dateStr = date.toISOString().split('T')[0];
    const channelName = `matrix_${serviceId}_${dateStr}`;

    console.log('[REALTIME_MATRIX] Subscribing to channel:', channelName);

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
          console.log('[REALTIME_MATRIX] Booking change detected:', payload);
          fetchMatrix();
        }
      )
      .subscribe((status) => {
        console.log('[REALTIME_MATRIX] Subscription status:', status);
      });

    return () => {
      if (channelRef.current) {
        console.log('[REALTIME_MATRIX] Unsubscribing from channel:', channelName);
        channelRef.current.unsubscribe();
      }
    };
  }, [enableRealtime, serviceId, date, fetchMatrix]);

  const getSlot = useCallback((timeSlot: string): MatrixSlot | undefined => {
    return matrix.get(timeSlot);
  }, [matrix]);

  return {
    matrix,
    loading,
    error,
    refetch: fetchMatrix,
    getSlot
  };
}
