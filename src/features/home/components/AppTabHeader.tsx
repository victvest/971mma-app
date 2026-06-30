import React, { useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useUnreadNotificationCount } from '@/features/notifications/hooks/useNotifications';
import { useActiveProfileAvatarUrl, useActiveProfileLabel } from '@/hooks/useActiveMemberId';
import { useAccountActionSheet } from '@/shared/hooks/useAccountActionSheet';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
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
  const unreadQuery = useUnreadNotificationCount();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { hasLimitedAccess, isAnonymousGuest } = useIsGuest();
  const { prompt, sheet } = useAccountActionSheet();

  const activeTab =
    (segments as string[]).filter((segment) => !segment.startsWith('(')).at(-1) || 'index';
  const isMainTab = ['index', 'schedule', 'checkin', 'coaches'].includes(activeTab);

  if (!isMainTab) return null;

  const handleOpenProfile = () => {
    if (isAnonymousGuest) {
      prompt('access-profile');
      return;
    }
    router.push('/(tabs)/profile');
  };

  const handleOpenNotifications = () => {
    if (hasLimitedAccess) {
      prompt('access-notifications');
      return;
    }
    router.push('/notifications');
  };

  return (
    <>
      <HomeHeader
        floating={floating}
        unreadCount={unreadQuery.data ?? 0}
        onOpenNotifications={handleOpenNotifications}
        avatarLabel={activeProfileLabel}
        avatarUrl={activeProfileAvatarUrl}
        onOpenProfile={handleOpenProfile}
        onOpenDrawer={() => setDrawerOpen(true)}
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
