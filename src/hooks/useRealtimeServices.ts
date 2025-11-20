import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeServicesOptions {
  professionalId: string | null;
  onServicesChange: () => void;
  onTeamChange?: () => void;
  enabled?: boolean;
}

export function useRealtimeServices({
  professionalId,
  onServicesChange,
  onTeamChange,
  enabled = true
}: UseRealtimeServicesOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const teamDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSubscribedRef = useRef(false);

  const debouncedServicesRefresh = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      console.log('[REALTIME_SERVICES] Triggering debounced services refresh');
      onServicesChange();
    }, 500);
  }, [onServicesChange]);

  const debouncedTeamRefresh = useCallback(() => {
    if (!onTeamChange) return;

    if (teamDebounceTimerRef.current) {
      clearTimeout(teamDebounceTimerRef.current);
    }

    teamDebounceTimerRef.current = setTimeout(() => {
      console.log('[REALTIME_SERVICES] Triggering debounced team refresh');
      onTeamChange();
    }, 500);
  }, [onTeamChange]);

  useEffect(() => {
    if (!enabled || !professionalId) {
      return;
    }

    const channelName = `services_${professionalId}_${Date.now()}`;

    console.log('[REALTIME_SERVICES] Setting up subscription:', {
      professionalId,
      channelName
    });

    if (channelRef.current) {
      console.log('[REALTIME_SERVICES] Cleaning up existing channel');
      channelRef.current.unsubscribe();
      channelRef.current = null;
      isSubscribedRef.current = false;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'services',
          filter: `professional_id=eq.${professionalId}`
        },
        (payload) => {
          console.log('[REALTIME_SERVICES] New service created:', payload);
          debouncedServicesRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'services',
          filter: `professional_id=eq.${professionalId}`
        },
        (payload) => {
          console.log('[REALTIME_SERVICES] Service updated:', payload);
          debouncedServicesRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'services',
          filter: `professional_id=eq.${professionalId}`
        },
        (payload) => {
          console.log('[REALTIME_SERVICES] Service deleted:', payload);
          debouncedServicesRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_team_members'
        },
        (payload) => {
          console.log('[REALTIME_SERVICES] Service team changed:', payload);
          debouncedTeamRefresh();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_professionals'
        },
        (payload) => {
          console.log('[REALTIME_SERVICES] Service professionals changed:', payload);
          debouncedServicesRefresh();
          debouncedTeamRefresh();
        }
      )
      .subscribe((status) => {
        console.log('[REALTIME_SERVICES] Subscription status:', status);

        if (status === 'SUBSCRIBED') {
          console.log('[REALTIME_SERVICES] Successfully subscribed to service changes');
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[REALTIME_SERVICES] Subscription failed:', status);
          isSubscribedRef.current = false;
        } else if (status === 'CLOSED') {
          console.log('[REALTIME_SERVICES] Channel closed');
          isSubscribedRef.current = false;
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[REALTIME_SERVICES] Cleaning up subscription');

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (teamDebounceTimerRef.current) {
        clearTimeout(teamDebounceTimerRef.current);
        teamDebounceTimerRef.current = null;
      }

      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }

      isSubscribedRef.current = false;
    };
  }, [professionalId, enabled, debouncedServicesRefresh, debouncedTeamRefresh]);

  return {
    isSubscribed: isSubscribedRef.current
  };
}
