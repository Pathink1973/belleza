import { supabase } from '../lib/supabase';

interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'booking' | 'review' | 'system';
  read: boolean;
  created_at: string;
}

/**
 * Gets unread notifications for a user
 */
export async function getUnreadNotifications(userId: string): Promise<Notification[]> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting notifications:', error);
    return [];
  }
}

/**
 * Marks notifications as read
 */
export async function markNotificationsAsRead(notificationIds: string[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .in('id', notificationIds);

    if (error) throw error;
  } catch (error) {
    console.error('Error marking notifications as read:', error);
  }
}

/**
 * Creates a new notification
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: 'booking' | 'review' | 'system' = 'system'
): Promise<void> {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert([{
        user_id: userId,
        title,
        message,
        type,
        read: false
      }]);

    if (error) throw error;
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}