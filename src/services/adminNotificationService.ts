// File: src/services/adminNotificationService.ts
import { supabase } from './supabase';
import { UserNotification, NotificationType } from '../types';

/**
 * Gửi thông báo in-app cho 1 user
 */
export const sendNotificationToUser = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .insert([{
        user_id: userId,
        type,
        title,
        message,
        metadata: metadata || {},
        is_read: false
      }]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
};

/**
 * Gửi thông báo hàng loạt cho danh sách users
 */
export const sendBatchNotification = async (
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  metadata?: Record<string, any>
): Promise<{ successCount: number; failedCount: number }> => {
  try {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      type,
      title,
      message,
      metadata: metadata || {},
      is_read: false
    }));

    // Chia nhỏ mảng nếu có quá nhiều users để tránh payload limit của Supabase
    const chunkSize = 100;
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < notifications.length; i += chunkSize) {
      const chunk = notifications.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('user_notifications')
        .insert(chunk);

      if (error) {
        console.error('Error in batch notification chunk:', error);
        failedCount += chunk.length;
      } else {
        successCount += chunk.length;
      }
    }

    return { successCount, failedCount };
  } catch (error) {
    console.error('Error sending batch notification:', error);
    return { successCount: 0, failedCount: userIds.length };
  }
};

/**
 * Lấy danh sách thông báo của user (Giới hạn mặc định 50 cái mới nhất)
 */
export const getUserNotifications = async (
  userId: string,
  limit = 50
): Promise<UserNotification[]> => {
  try {
    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as UserNotification[];
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    return [];
  }
};

/**
 * Đánh dấu một thông báo đã đọc
 */
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

/**
 * Đánh dấu tất cả thông báo của user đã đọc
 */
export const markAllNotificationsAsRead = async (userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

/**
 * Lấy số lượng thông báo chưa đọc của user
 */
export const getUnreadCount = async (userId: string): Promise<number> => {
  try {
    const { count, error } = await supabase
      .from('user_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  } catch (error) {
    console.error('Error getting unread count:', error);
    return 0;
  }
};
