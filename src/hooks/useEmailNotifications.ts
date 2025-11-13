import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export function useEmailNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    subscribeToEmails();
  }, []);

  const loadUnreadCount = async () => {
    try {
      const { count, error } = await supabase
        .from('contact_messages')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'unread');

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading unread email count:', error);
    }
  };

  const subscribeToEmails = () => {
    const subscription = supabase
      .channel('email_notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contact_messages'
        },
        () => {
          loadUnreadCount();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  return { unreadCount };
}
