import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getNotificationPreferences,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '@/services/database/notifications.repository';
import { NOTIFICATIONS_STALE_MS } from '@/lib/queryCachePolicy';
import { useAuthStore } from '@/stores/useAuthStore';

export const notificationsKey = ['notifications'] as const;
export const unreadCountKey = ['notifications-unread'] as const;
export const notificationPreferencesKey = ['notification-preferences'] as const;

export function useNotifications() {
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useQuery({
    queryKey: [...notificationsKey, authUserId],
    queryFn: () => getNotifications(),
    enabled: Boolean(authUserId),
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

export function useUnreadNotificationCount() {
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useQuery({
    queryKey: [...unreadCountKey, authUserId],
    queryFn: getUnreadNotificationCount,
    enabled: Boolean(authUserId),
    staleTime: NOTIFICATIONS_STALE_MS,
    refetchInterval: 60 * 1000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...notificationsKey, authUserId] });
      void queryClient.invalidateQueries({ queryKey: [...unreadCountKey, authUserId] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...notificationsKey, authUserId] });
      void queryClient.invalidateQueries({ queryKey: [...unreadCountKey, authUserId] });
    },
  });
}

export function useNotificationPreferences() {
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useQuery({
    queryKey: [...notificationPreferencesKey, authUserId],
    queryFn: getNotificationPreferences,
    enabled: Boolean(authUserId),
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useMutation({
    mutationFn: updateNotificationPreferences,
    onSuccess: (data) => {
      queryClient.setQueryData([...notificationPreferencesKey, authUserId], data);
    },
  });
}
