import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createAnnouncement,
  getAnnouncements,
} from '@/services/database/announcements.repository';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  notificationsKey,
  unreadCountKey,
} from '@/features/notifications/hooks/useNotifications';

export const announcementsKey = ['announcements'] as const;

export function useAnnouncements() {
  return useQuery({
    queryKey: announcementsKey,
    queryFn: () => getAnnouncements(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: announcementsKey });
      if (authUserId) {
        void queryClient.invalidateQueries({ queryKey: [...notificationsKey, authUserId] });
        void queryClient.invalidateQueries({ queryKey: [...unreadCountKey, authUserId] });
      } else {
        void queryClient.invalidateQueries({ queryKey: notificationsKey });
        void queryClient.invalidateQueries({ queryKey: unreadCountKey });
      }
    },
    meta: { requiresCoach: role === 'coach' || role === 'admin' },
  });
}
