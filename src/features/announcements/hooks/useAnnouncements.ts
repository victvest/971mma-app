import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  coachSendAnnouncement,
  createAnnouncement,
  getAnnouncements,
  listCoachAnnouncementTargets,
  type CoachAnnouncementAudienceMode,
} from '@/services/database/announcements.repository';
import { useAuthStore } from '@/stores/useAuthStore';
import { notificationsKey, unreadCountKey } from '@/features/notifications/hooks/useNotifications';

export const announcementsKey = ['announcements'] as const;
export const coachAnnouncementTargetsKey = ['coach-announcement-targets'] as const;

export function useAnnouncements() {
  return useQuery({
    queryKey: announcementsKey,
    queryFn: () => getAnnouncements(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCoachAnnouncementTargets(enabled = true) {
  const role = useAuthStore((s) => s.role);

  return useQuery({
    queryKey: coachAnnouncementTargetsKey,
    queryFn: () => listCoachAnnouncementTargets(),
    enabled: enabled && (role === 'coach' || role === 'admin'),
    staleTime: 30 * 1000,
  });
}

function invalidateAnnouncementQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  authUserId: string,
) {
  void queryClient.invalidateQueries({ queryKey: announcementsKey });
  void queryClient.invalidateQueries({ queryKey: coachAnnouncementTargetsKey });
  if (authUserId) {
    void queryClient.invalidateQueries({ queryKey: [...notificationsKey, authUserId] });
    void queryClient.invalidateQueries({ queryKey: [...unreadCountKey, authUserId] });
  } else {
    void queryClient.invalidateQueries({ queryKey: notificationsKey });
    void queryClient.invalidateQueries({ queryKey: unreadCountKey });
  }
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      invalidateAnnouncementQueries(queryClient, authUserId);
    },
    meta: { requiresCoach: role === 'coach' || role === 'admin' },
  });
}

export function useCoachSendAnnouncement() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const authUserId = useAuthStore((s) => s.user?.id ?? '');

  return useMutation({
    mutationFn: (input: {
      title: string;
      body: string;
      mode: CoachAnnouncementAudienceMode;
      classIds?: string[];
    }) => coachSendAnnouncement(input),
    onSuccess: () => {
      invalidateAnnouncementQueries(queryClient, authUserId);
    },
    meta: { requiresCoach: role === 'coach' || role === 'admin' },
  });
}
