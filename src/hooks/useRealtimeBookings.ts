import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeBookingsOptions {
  serviceId: string | null;
  date: string | null;
  onBookingChange: () => void;
  enabled?: boolean;
}

export function useRealtimeBookings({
  serviceId,
  date,
  onBookingChange,
  enabled = true
}: UseRealtimeBookingsOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);

  const debouncedRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('[REALTIME_BOOKINGS] Triggering debounced refresh');
      onBookingChange();
    }, 500);
  }, [onBookingChange]);

  useEffect(() => {
    if (!enabled || !serviceId || !date) {
      return;
    }

    const dateStr = date;
    const channelName = `bookings_${serviceId}_${dateStr}_${Date.now()}`;

    console.log('[REALTIME_BOOKINGS] Setting up subscription:', {
      serviceId,
      date: dateStr,
      channelName
    });

    if (channelRef.current) {
      console.log('[REALTIME_BOOKINGS] Cleaning up existing channel');
      channelRef.current.unsubscribe();
      channelRef.current = null;
      isSubscribedRef.current = false;
    }

    const startOfDay = new Date(`${dateStr}T00:00:00`);
    const endOfDay = new Date(`${dateStr}T23:59:59`);

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings',
          filter: `service_id=eq.${serviceId}`
        },
        (payload) => {
          console.log('[REALTIME_BOOKINGS] New booking created:', payload);
          const bookingStartTime = new Date(payload.new.start_time);

          if (bookingStartTime >= startOfDay && bookingStartTime <= endOfDay) {
            console.log('[REALTIME_BOOKINGS] Booking is for selected date, refreshing...');
            debouncedRefresh();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `service_id=eq.${serviceId}`
        },
        (payload) => {
          console.log('[REALTIME_BOOKINGS] Booking updated:', payload);

          const oldStartTime = new Date(payload.old.start_time);
          const newStartTime = new Date(payload.new.start_time);

          const oldInRange = oldStartTime >= startOfDay && oldStartTime <= endOfDay;
          const newInRange = newStartTime >= startOfDay && newStartTime <= endOfDay;

          if (oldInRange || newInRange) {
            console.log('[REALTIME_BOOKINGS] Booking affects selected date, refreshing...');
            debouncedRefresh();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'bookings',
          filter: `service_id=eq.${serviceId}`
        },
        (payload) => {
          console.log('[REALTIME_BOOKINGS] Booking deleted:', payload);
          const bookingStartTime = new Date(payload.old.start_time);

          if (bookingStartTime >= startOfDay && bookingStartTime <= endOfDay) {
            console.log('[REALTIME_BOOKINGS] Deleted booking was for selected date, refreshing...');
            debouncedRefresh();
          }
        }
      )
      .subscribe((status) => {
        console.log('[REALTIME_BOOKINGS] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('[REALTIME_BOOKINGS] Successfully subscribed to booking changes');
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[REALTIME_BOOKINGS] Subscription failed:', status);
          isSubscribedRef.current = false;
        } else if (status === 'CLOSED') {
          console.log('[REALTIME_BOOKINGS] Channel closed');
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[REALTIME_BOOKINGS] Cleaning up subscription');

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      isSubscribedRef.current = false;
    };
  }, [serviceId, date, enabled, debouncedRefresh]);

  return {
    isSubscribed: isSubscribedRef.current
  };
}
