import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface RealtimeAvailabilityData {
  available_count: number;
  total_capacity: number;
  occupied_count: number;
  utilization_percentage: number;
  available_professionals: any[];
  occupied_professionals: any[];
}

interface DailyAvailabilitySlot {
  time_slot: string;
  available_count: number;
  total_capacity: number;
  is_available: boolean;
  utilization_percentage: number;
  block_reason?: string | null;
}

interface UseRealtimeAvailabilityOptions {
  serviceId: string | null;
  date: Date | null;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useRealtimeAvailability({
  serviceId,
  date,
  autoRefresh = true,
  refreshInterval = 30000
}: UseRealtimeAvailabilityOptions) {
  const [slotAvailability, setSlotAvailability] = useState<Map<string, RealtimeAvailabilityData>>(new Map());
  const [dailyMatrix, setDailyMatrix] = useState<DailyAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const channelRef = useRef<any>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Função para buscar disponibilidade de um slot específico
  const fetchSlotAvailability = useCallback(async (time: string): Promise<RealtimeAvailabilityData | null> => {
    if (!serviceId || !date) return null;

    try {
      const timeOnly = time.split(':').slice(0, 2).join(':');
      const [hours, minutes] = timeOnly.split(':').map(Number);
      const startTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

      let endHours = hours;
      let endMinutes = minutes + 30;
      if (endMinutes >= 60) {
        endHours += 1;
        endMinutes -= 60;
      }
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}:00`;

      const dateStr = date.toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('get_realtime_availability_count', {
        p_service_id: serviceId,
        p_date: dateStr,
        p_start_time: startTime,
        p_end_time: endTime
      });

      if (error) {
        console.error('[REALTIME_AVAILABILITY] Error fetching slot:', error);
        throw error;
      }

      if (data && data.length > 0) {
        return data[0];
      }

      return null;
    } catch (err) {
      console.error('[REALTIME_AVAILABILITY] Error in fetchSlotAvailability:', err);
      return null;
    }
  }, [serviceId, date]);

  // Função para buscar matriz diária completa
  const fetchDailyMatrix = useCallback(async () => {
    if (!serviceId || !date) return;

    setLoading(true);
    setError(null);

    try {
      const dateStr = date.toISOString().split('T')[0];

      console.log('[REALTIME_AVAILABILITY] Fetching matrix for:', serviceId, dateStr);

      const { data, error } = await supabase.rpc('get_service_team_availability_matrix', {
        p_service_id: serviceId,
        p_date: dateStr
      });

      if (error) {
        console.error('[REALTIME_AVAILABILITY] Error fetching daily matrix:', error);
        throw error;
      }

      console.log('[REALTIME_AVAILABILITY] Matrix data received:', {
        totalSlots: data?.length,
        firstSlot: data?.[0],
        lastSlot: data?.[data.length - 1],
        rawData: data
      });

      if (data && Array.isArray(data) && data.length > 0) {
        // Normalizar dados da matriz
        const normalizedData = data.map((slot: any) => ({
          time_slot: slot.time_slot || slot.slot_time || '',
          available_count: slot.available_count ?? slot.available ?? 0,
          total_capacity: slot.total_capacity ?? slot.total ?? 0,
          is_available: (slot.available_count ?? slot.available ?? 0) > 0,
          utilization_percentage: slot.utilization_percentage ?? 0,
          block_reason: slot.block_reason || null
        }));

        setDailyMatrix(normalizedData);

        // Atualizar mapa de slots
        const newMap = new Map<string, RealtimeAvailabilityData>();
        normalizedData.forEach((slot: DailyAvailabilitySlot) => {
          const timeKey = slot.time_slot.substring(0, 5);
          newMap.set(timeKey, {
            available_count: slot.available_count,
            total_capacity: slot.total_capacity,
            occupied_count: slot.total_capacity - slot.available_count,
            utilization_percentage: slot.utilization_percentage,
            available_professionals: [],
            occupied_professionals: []
          });
        });
        setSlotAvailability(newMap);
        setLastUpdate(new Date());

        console.log('[REALTIME_AVAILABILITY] Matrix processed:', normalizedData.length, 'slots');
      } else {
        console.warn('[REALTIME_AVAILABILITY] No matrix data, trying fallback method');

        // Fallback: tentar obter disponibilidade usando método alternativo
        const { data: teamMembers } = await supabase
          .from('service_team_members')
          .select('team_member_id')
          .eq('service_id', serviceId);

        const totalCapacity = teamMembers?.length || 1;

        // Gerar slots genéricos das 9h às 18h
        const slots: DailyAvailabilitySlot[] = [];
        for (let hour = 9; hour < 18; hour++) {
          for (let minute = 0; minute < 60; minute += 30) {
            slots.push({
              time_slot: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`,
              available_count: totalCapacity,
              total_capacity: totalCapacity,
              is_available: true,
              utilization_percentage: 0
            });
          }
        }

        setDailyMatrix(slots);
        console.log('[REALTIME_AVAILABILITY] Using fallback data with', totalCapacity, 'capacity');
      }
    } catch (err: any) {
      console.error('[REALTIME_AVAILABILITY] Error in fetchDailyMatrix:', err);
      setError(err.message || 'Erro ao carregar disponibilidade');
    } finally {
      setLoading(false);
    }
  }, [serviceId, date]);

  // Função para buscar slots disponíveis
  const fetchAvailableSlots = useCallback(async () => {
    if (!serviceId || !date) return [];

    try {
      const dateStr = date.toISOString().split('T')[0];

      const { data, error } = await supabase.rpc('get_available_slots_for_date', {
        p_service_id: serviceId,
        p_date: dateStr
      });

      if (error) {
        console.error('[REALTIME_AVAILABILITY] Error fetching available slots:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('[REALTIME_AVAILABILITY] Error in fetchAvailableSlots:', err);
      return [];
    }
  }, [serviceId, date]);

  // Setup de Realtime subscriptions
  useEffect(() => {
    if (!serviceId || !date) return;

    // Fetch inicial
    fetchDailyMatrix();

    // Setup Realtime channel
    const dateStr = date.toISOString().split('T')[0];
    const channelName = `realtime_availability_${serviceId}_${dateStr}`;

    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    // IMPORTANT: Try to setup realtime, but gracefully handle failures for anonymous users
    try {
      const channel = supabase
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
            console.log('[REALTIME_AVAILABILITY] Booking changed, refreshing...', payload);
            fetchDailyMatrix();
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'blocked_dates'
          },
          (payload) => {
            console.log('[REALTIME_AVAILABILITY] Blocked dates changed, refreshing...', payload);
            fetchDailyMatrix();
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[REALTIME_AVAILABILITY] Realtime subscription active');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[REALTIME_AVAILABILITY] Realtime subscription failed, falling back to polling', status);
            // If realtime fails, ensure polling is active as fallback
            if (!refreshTimerRef.current && autoRefresh) {
              refreshTimerRef.current = setInterval(() => {
                console.log('[REALTIME_AVAILABILITY] Polling fallback refresh');
                fetchDailyMatrix();
              }, refreshInterval || 30000);
            }
          }
        });

      channelRef.current = channel;
    } catch (err) {
      console.warn('[REALTIME_AVAILABILITY] Failed to setup realtime, using polling only', err);
    }

    // Auto-refresh timer (works for both authenticated and anonymous users)
    if (autoRefresh && refreshInterval > 0) {
      refreshTimerRef.current = setInterval(() => {
        console.log('[REALTIME_AVAILABILITY] Auto-refresh triggered');
        fetchDailyMatrix();
      }, refreshInterval);
    }

    // Cleanup
    return () => {
      if (channelRef.current) {
        try {
          channelRef.current.unsubscribe();
        } catch (err) {
          console.warn('[REALTIME_AVAILABILITY] Error unsubscribing from channel', err);
        }
        channelRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [serviceId, date, autoRefresh, refreshInterval, fetchDailyMatrix]);

  // Função helper para obter disponibilidade de um slot
  const getSlotAvailability = useCallback((time: string): RealtimeAvailabilityData | null => {
    const timeKey = time.split(':').slice(0, 2).join(':');
    return slotAvailability.get(timeKey) || null;
  }, [slotAvailability]);

  // Calcular estatísticas do dia
  const dailyStats = useCallback(() => {
    if (dailyMatrix.length === 0) {
      return {
        totalSlots: 0,
        availableSlots: 0,
        occupiedSlots: 0,
        averageOccupancy: 0,
        totalCapacity: 0,
        currentAvailable: 0
      };
    }

    // CRITICAL FIX: Correct calculation using database-provided values
    // The matrix now returns correct values from get_service_team_availability_matrix
    // Each slot has: total_capacity (team size), available_count, occupied_count

    // Sum available slots across all time periods
    const availableSum = dailyMatrix.reduce((sum, s) => sum + (s.available_count || 0), 0);

    // Sum total capacity across all time periods (team_size × number_of_slots)
    const totalCapacitySum = dailyMatrix.reduce((sum, s) => sum + (s.total_capacity || 0), 0);

    // Sum occupied slots (confirmed bookings)
    const occupiedSum = dailyMatrix.reduce((sum, s) => sum + ((s.total_capacity || 0) - (s.available_count || 0)), 0);

    // Team size (should be same for all slots)
    const teamSize = dailyMatrix.length > 0 ? (dailyMatrix[0].total_capacity || 1) : 1;

    // Percentage of occupation based on SLOTS (not time periods)
    // Example: 2 confirmed / 22 total = 9.09% occupied
    const averageOccupancy = totalCapacitySum > 0 ? ((occupiedSum / totalCapacitySum) * 100) : 0;

    const stats = {
      totalSlots: totalCapacitySum,      // TOTAL CAPACITY: team_size × time_slots (e.g., 2 × 21 = 42)
      availableSlots: availableSum,      // AVAILABLE: sum of all available_count from matrix
      occupiedSlots: occupiedSum,        // OCCUPIED: total - available (confirmed bookings)
      averageOccupancy: Math.round(averageOccupancy * 100) / 100,
      totalCapacity: teamSize,           // Team size (professionals per slot)
      currentAvailable: availableSum     // Same as availableSlots
    };

    console.log('[REALTIME_AVAILABILITY] Daily stats calculated (FIXED):', {
      matrixLength: dailyMatrix.length,
      teamSize,
      firstSlot: dailyMatrix[0],
      lastSlot: dailyMatrix[dailyMatrix.length - 1],
      availableSum,
      totalCapacitySum,
      occupiedSum,
      stats,
      formula: `${teamSize} professionals × ${dailyMatrix.length} time slots = ${totalCapacitySum} total capacity`,
      detailedCalc: {
        availableFormula: `sum of all available_count = ${availableSum}`,
        totalFormula: `sum of all total_capacity = ${totalCapacitySum}`,
        occupiedFormula: `totalCapacity - available = ${totalCapacitySum} - ${availableSum} = ${occupiedSum}`
      }
    });

    return stats;
  }, [dailyMatrix]);

  return {
    slotAvailability,
    dailyMatrix,
    loading,
    error,
    lastUpdate,
    fetchSlotAvailability,
    fetchDailyMatrix,
    fetchAvailableSlots,
    getSlotAvailability,
    dailyStats: dailyStats(),
    refetch: fetchDailyMatrix
  };
}
