import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useUnreadNotificationCount } from '@/features/notifications/hooks/useNotifications';
import { useActiveProfileAvatarUrl, useActiveProfileLabel } from '@/hooks/useActiveMemberId';

/**
 * Centralises the HomeHeader + DrawerMenu state needed by every coach screen.
 * Mirrors the same data setup used in rewards.tsx / belt-path.tsx so the header
 * looks and behaves identically to member-mode screens.
 */
export function useCoachHeader() {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const unreadQuery = useUnreadNotificationCount();
  const activeProfileLabel = useActiveProfileLabel();
  const activeProfileAvatarUrl = useActiveProfileAvatarUrl();

  const sharedHeaderProps = {
    unreadCount: unreadQuery.data ?? 0,
    onOpenNotifications: () => router.push('/notifications'),
    avatarLabel: activeProfileLabel,
    avatarUrl: activeProfileAvatarUrl,
    onOpenProfile: () => router.push('/(coach)/profile'),
    onOpenDrawer: () => setDrawerOpen(true),
  };

  return {
    drawerOpen,
    openDrawer: () => setDrawerOpen(true),
    closeDrawer: () => setDrawerOpen(false),
    sharedHeaderProps,
  };
}
