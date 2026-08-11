import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBroadcastNotifications,
  getBroadcastUnreadNotificationCount,
  getGuestBroadcastNotifications,
  getNotifications,
  getNotificationPreferences,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '@/services/database/notifications.repository';
import {
  markGuestBroadcastsSeen,
  getGuestBroadcastUnreadCount,
} from '@/features/notifications/services/guestBroadcastReadState';
import { NOTIFICATIONS_STALE_MS } from '@/lib/queryCachePolicy';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
import { useAuthStore } from '@/stores/useAuthStore';
import type { NotificationItem } from '@/types/domain';

export const notificationsKey = ['notifications'] as const;
export const unreadCountKey = ['notifications-unread'] as const;
export const guestBroadcastUnreadKey = ['notifications-unread', 'broadcast-guest'] as const;
export const notificationPreferencesKey = ['notification-preferences'] as const;

function stampReadAt(items: NotificationItem[] | undefined, id: string, readAt: string) {
  if (!items) return items;
  return items.map((item) => (item.id === id && !item.readAt ? { ...item, readAt } : item));
}

function stampAllRead(items: NotificationItem[] | undefined, readAt: string) {
  if (!items) return items;
  return items.map((item) => (item.readAt ? item : { ...item, readAt }));
}

export function useNotifications() {
  const authUserId = useAuthStore((s) => s.user?.id ?? '');
  const { hasLimitedAccess, isAnonymousGuest } = useIsGuest();
  const guestBroadcastMode = hasLimitedAccess && isAnonymousGuest;

  return useQuery({
    queryKey: guestBroadcastMode
      ? [...notificationsKey, 'broadcast-guest']
      : hasLimitedAccess
        ? [...notificationsKey, 'broadcast', authUserId]
        : [...notificationsKey, authUserId],
    queryFn: () => {
      if (guestBroadcastMode) return getGuestBroadcastNotifications();
      if (hasLimitedAccess) return getBroadcastNotifications();
      return getNotifications();
    },
    enabled: guestBroadcastMode || hasLimitedAccess ? true : Boolean(authUserId),
    staleTime: NOTIFICATIONS_STALE_MS,
  });
}

export function useUnreadNotificationCount(options?: { enabled?: boolean }) {
  const authUserId = useAuthStore((s) => s.user?.id ?? '');
  const { hasLimitedAccess, isAnonymousGuest } = useIsGuest();
  const guestBroadcastMode = hasLimitedAccess && isAnonymousGuest;
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: guestBroadcastMode
      ? guestBroadcastUnreadKey
      : hasLimitedAccess
        ? [...unreadCountKey, 'broadcast', authUserId]
        : [...unreadCountKey, authUserId],
    queryFn: () => {
      if (guestBroadcastMode) return getGuestBroadcastUnreadCount();
      if (hasLimitedAccess) return getBroadcastUnreadNotificationCount();
      return getUnreadNotificationCount();
    },
    enabled: enabled && (guestBroadcastMode || hasLimitedAccess ? true : Boolean(authUserId)),
    staleTime: NOTIFICATIONS_STALE_MS,
    refetchInterval: enabled ? 60 * 1000 : false,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markNotificationRead,
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey: notificationsKey });
      await queryClient.cancelQueries({ queryKey: unreadCountKey });

      const previousLists = queryClient.getQueriesData<NotificationItem[]>({
        queryKey: notificationsKey,
      });
      const previousCounts = queryClient.getQueriesData<number>({ queryKey: unreadCountKey });
      const readAt = new Date().toISOString();

      let markedUnread = false;
      for (const [, list] of previousLists) {
        if (list?.some((item) => item.id === notificationId && !item.readAt)) {
          markedUnread = true;
          break;
        }
      }

      queryClient.setQueriesData<NotificationItem[]>({ queryKey: notificationsKey }, (old) =>
        stampReadAt(old, notificationId, readAt),
      );
      if (markedUnread) {
        queryClient.setQueriesData<number>({ queryKey: unreadCountKey }, (old) => {
          if (typeof old !== 'number' || old <= 0) return old;
          return old - 1;
        });
      }

      return { previousLists, previousCounts };
    },
    onError: (_error, _id, context) => {
      context?.previousLists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.previousCounts.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKey });
      void queryClient.invalidateQueries({ queryKey: unreadCountKey });
      void queryClient.invalidateQueries({ queryKey: guestBroadcastUnreadKey });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: notificationsKey });
      await queryClient.cancelQueries({ queryKey: unreadCountKey });

      const previousLists = queryClient.getQueriesData<NotificationItem[]>({
        queryKey: notificationsKey,
      });
      const previousCounts = queryClient.getQueriesData<number>({ queryKey: unreadCountKey });
      const readAt = new Date().toISOString();

      queryClient.setQueriesData<NotificationItem[]>({ queryKey: notificationsKey }, (old) =>
        stampAllRead(old, readAt),
      );
      queryClient.setQueriesData<number>({ queryKey: unreadCountKey }, () => 0);

      return { previousLists, previousCounts };
    },
    onError: (_error, _vars, context) => {
      context?.previousLists.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.previousCounts.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: notificationsKey });
      void queryClient.invalidateQueries({ queryKey: unreadCountKey });
      void queryClient.invalidateQueries({ queryKey: guestBroadcastUnreadKey });
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

export { markGuestBroadcastsSeen };
