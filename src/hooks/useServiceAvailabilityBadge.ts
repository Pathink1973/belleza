import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface AvailabilityBadgeData {
  availableToday: number;
  totalCapacity: number;
  nextAvailableSlot: {
    date: string;
    time: string;
    availableCount: number;
  } | null;
}

export function useServiceAvailabilityBadge(serviceId: string | null) {
  const [badgeData, setBadgeData] = useState<AvailabilityBadgeData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAvailabilityBadge = useCallback(async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];

      // Get morning slot availability as representative for "today"
      const { data: todayData } = await supabase.rpc(
        'get_available_professionals_count_quick',
        {
          p_service_id: serviceId,
          p_date: today,
          p_start_time: '10:00:00',
          p_end_time: '10:30:00'
        }
      );

      // Get service capacity
      const { data: capacityData } = await supabase.rpc(
        'get_service_total_capacity',
        {
          p_service_id: serviceId
        }
      );

      // Get next available slot
      const { data: nextSlotData } = await supabase.rpc(
        'get_next_available_slot_with_professionals',
        {
          p_service_id: serviceId,
          p_start_date: today,
          p_max_days_ahead: 7
        }
      );

      setBadgeData({
        availableToday: todayData || 0,
        totalCapacity: capacityData || 1,
        nextAvailableSlot: nextSlotData && nextSlotData.length > 0
          ? {
              date: nextSlotData[0].slot_date,
              time: nextSlotData[0].slot_time,
              availableCount: nextSlotData[0].available_count
            }
          : null
      });
    } catch (err) {
      console.error('[AVAILABILITY_BADGE] Error fetching:', err);
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => {
    fetchAvailability Badge();
  }, [fetchAvailabilityBadge]);

  return {
    badgeData,
    loading,
    refetch: fetchAvailabilityBadge
  };
}
