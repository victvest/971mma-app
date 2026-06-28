import React, { useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useUnreadNotificationCount } from '@/features/notifications/hooks/useNotifications';
import { useActiveProfileAvatarUrl, useActiveProfileLabel } from '@/hooks/useActiveMemberId';
import { COACH_MAIN_TAB_NAMES } from '@/features/coach/navigation/coachTabRoutes';
import { HomeHeader } from '@/features/home/components/HomeHeader';
import { CoachDrawerMenu } from './CoachDrawerMenu';

type CoachAppTabHeaderProps = {
  floating?: boolean;
  blurTargetRef?: RefObject<View | null>;
};

export function CoachAppTabHeader({ floating = true, blurTargetRef }: CoachAppTabHeaderProps) {
  const router = useRouter();
  const segments = useSegments();
  const activeProfileLabel = useActiveProfileLabel();
  const activeProfileAvatarUrl = useActiveProfileAvatarUrl();
  const unreadQuery = useUnreadNotificationCount();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeTab =
    (segments as string[]).filter((segment) => !segment.startsWith('(')).at(-1) || 'index';
  const isMainTab = COACH_MAIN_TAB_NAMES.includes(activeTab as (typeof COACH_MAIN_TAB_NAMES)[number]);

  if (!isMainTab) return null;

  return (
    <>
      <HomeHeader
        floating={floating}
        unreadCount={unreadQuery.data ?? 0}
        onOpenNotifications={() => router.push('/notifications')}
        avatarLabel={activeProfileLabel}
        avatarUrl={activeProfileAvatarUrl}
        onOpenProfile={() => router.push('/(coach)/profile')}
        onOpenDrawer={() => setDrawerOpen(true)}
      />
      <CoachDrawerMenu
        visible={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        blurTargetRef={blurTargetRef}
      />
    </>
  );
}
