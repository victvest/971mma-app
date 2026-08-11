import React, { useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useUnreadNotificationCount } from '@/features/notifications/hooks/useNotifications';
import {
  useActiveGuardianLink,
  useActiveProfileAvatarUrl,
  useActiveProfileLabel,
  useIsViewingChildProfile,
} from '@/hooks/useActiveMemberId';
import { useAccountActionSheet } from '@/shared/hooks/useAccountActionSheet';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
import { useActiveProfileStore } from '@/stores/useActiveProfileStore';
import { HomeHeader } from './HomeHeader';
import { DrawerMenu } from './DrawerMenu';

type AppTabHeaderProps = {
  floating?: boolean;
  blurTargetRef?: RefObject<View | null>;
};

export function AppTabHeader({ floating = true, blurTargetRef }: AppTabHeaderProps) {
  const router = useRouter();
  const segments = useSegments();
  const activeProfileLabel = useActiveProfileLabel();
  const activeProfileAvatarUrl = useActiveProfileAvatarUrl();
  const viewingChild = useIsViewingChildProfile();
  const activeGuardianLink = useActiveGuardianLink();
  const unreadQuery = useUnreadNotificationCount({ enabled: !viewingChild });
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { isAnonymousGuest } = useIsGuest();
  const { prompt, sheet } = useAccountActionSheet();
  const setActiveUserId = useActiveProfileStore((s) => s.setActiveUserId);

  const isManagedChild = viewingChild;

  const handleLogoutChild = () => {
    setActiveUserId(null);
  };

  const activeTab =
    (segments as string[]).filter((segment) => !segment.startsWith('(')).at(-1) || 'index';
  const mainTabs = viewingChild
    ? ['index', 'checkin']
    : ['index', 'schedule', 'feed', 'checkin', 'coaches'];
  const isMainTab = mainTabs.includes(activeTab);

  if (!isMainTab) return null;

  const handleOpenProfile = () => {
    if (isAnonymousGuest) {
      prompt('access-profile');
      return;
    }
    router.push('/(tabs)/profile');
  };

  const handleOpenNotifications = () => {
    if (viewingChild) return;
    router.push('/notifications');
  };

  return (
    <>
      <HomeHeader
        floating={floating}
        unreadCount={viewingChild ? 0 : (unreadQuery.data ?? 0)}
        onOpenNotifications={handleOpenNotifications}
        avatarLabel={activeProfileLabel}
        avatarUrl={activeProfileAvatarUrl}
        onOpenProfile={handleOpenProfile}
        onOpenDrawer={() => setDrawerOpen(true)}
        showNotifications={!viewingChild}
        isManagedChild={isManagedChild}
        onLogoutChild={handleLogoutChild}
      />
      <DrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        blurTargetRef={blurTargetRef}
        onLockedRoute={prompt}
      />
      {sheet}
    </>
  );
}
