import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface SlotCapacity {
  time: string;
  isAvailable: boolean;
  totalCapacity: number;
  occupiedCount: number;
  availableCount: number;
  blockedReason?: string;
  blockingFactor?: string;
  availableProfessionals: any[];
  occupiedProfessionals: any[];
}

interface DailyCapacitySummary {
  totalCapacity: number;
  totalSlots: number;
  availableSlots: number;
  occupiedSlots: number;
  fullyBookedSlots: number;
  occupationPercentage: number;
}

export function useServiceCapacity(serviceId: string | null, date: Date) {
  const [slotsCapacity, setSlotsCapacity] = useState<Map<string, SlotCapacity>>(new Map());
  const [dailySummary, setDailySummary] = useState<DailyCapacitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSlotCapacity = async (time: string) => {
    if (!serviceId) return null;

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

      // CRITICAL FIX: Validate UUID format before calling RPC
      // Pattern: 8-4-4-4-12 hexadecimal characters
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(serviceId)) {
        console.error('[UUID VALIDATION] Invalid service ID format:', serviceId);
        throw new Error(`Invalid UUID format for service_id: ${serviceId}`);
      }

      const { data, error } = await supabase
        .rpc('get_unified_slot_availability', {
          p_service_id: serviceId,
          p_date: dateStr,
          p_start_time: startTime,
          p_end_time: endTime
        });

      if (error) {
        console.error('Error fetching slot capacity:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const slot = data[0];
        return {
          time: timeOnly,
          isAvailable: slot.is_available,
          totalCapacity: slot.total_capacity,
          occupiedCount: slot.occupied_count,
          availableCount: slot.available_count,
          blockedReason: slot.blocked_reason,
          blockingFactor: slot.blocking_factor,
          availableProfessionals: slot.available_professionals || [],
          occupiedProfessionals: slot.occupied_professionals || []
        };
      }

      return null;
    } catch (err) {
      console.error('Error in fetchSlotCapacity:', err);
      return null;
    }
  };

  const fetchDailySummary = async () => {
    if (!serviceId) return;

    try {
      setLoading(true);
      setError(null);

      const dateStr = date.toISOString().split('T')[0];

      // CRITICAL FIX: Validate UUID format before calling RPC
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(serviceId)) {
        console.error('[UUID VALIDATION] Invalid service ID format:', serviceId);
        throw new Error(`Invalid UUID format for service_id: ${serviceId}`);
      }

      const { data, error } = await supabase
        .rpc('get_service_daily_capacity_summary', {
          p_service_id: serviceId,
          p_date: dateStr
        });

      if (error) {
        console.error('Error fetching daily summary:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const summary = data[0];
        setDailySummary({
          totalCapacity: summary.total_capacity,
          totalSlots: summary.total_slots,
          availableSlots: summary.available_slots,
          occupiedSlots: summary.occupied_slots,
          fullyBookedSlots: summary.fully_booked_slots,
          occupationPercentage: parseFloat(summary.occupation_percentage)
        });
      }
    } catch (err: any) {
      console.error('Error in fetchDailySummary:', err);
      setError(err.message || 'Erro ao carregar resumo de capacidade');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSlotsCapacity = async () => {
    if (!serviceId) return;

    try {
      setLoading(true);
      setError(null);

      const newSlotsMap = new Map<string, SlotCapacity>();

      for (let hour = 9; hour <= 19; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          if (hour === 19 && minute > 30) break;

          const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
          const capacity = await fetchSlotCapacity(time);

          if (capacity) {
            newSlotsMap.set(time, capacity);
          }
        }
      }

      setSlotsCapacity(newSlotsMap);
    } catch (err: any) {
      console.error('Error in fetchAllSlotsCapacity:', err);
      setError(err.message || 'Erro ao carregar capacidade dos horários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (serviceId && date) {
      fetchDailySummary();
      fetchAllSlotsCapacity();
    }
  }, [serviceId, date]);

  useEffect(() => {
    if (!serviceId) return;

    const channel = supabase
      .channel(`availability_${serviceId}_${date.toISOString().split('T')[0]}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings',
          filter: `service_id=eq.${serviceId}`
        },
        (payload) => {
          console.log('[REALTIME] Booking changed, refreshing capacity', payload);
          fetchDailySummary();
          fetchAllSlotsCapacity();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [serviceId, date]);

  return {
    slotsCapacity,
    dailySummary,
    loading,
    error,
    refetch: () => {
      fetchDailySummary();
      fetchAllSlotsCapacity();
    },
    fetchSlotCapacity
  };
}
