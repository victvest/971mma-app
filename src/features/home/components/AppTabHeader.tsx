import React, { useState, type RefObject } from 'react';
import type { View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useUnreadNotificationCount } from '@/features/notifications/hooks/useNotifications';
import { useActiveProfileAvatarUrl, useActiveProfileLabel } from '@/hooks/useActiveMemberId';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDialog } from '@/shared/components/Dialog/useDialog';
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

  const role = useAuthStore((s) => s.role);
  const isGuest = role === 'guest';
  const { showDialog } = useDialog();

  const activeTab =
    (segments as string[]).filter((segment) => !segment.startsWith('(')).at(-1) || 'index';
  const isMainTab = ['index', 'schedule', 'checkin', 'coaches'].includes(activeTab);

  if (!isMainTab) return null;

  const promptGuestAuth = (title: string, message: string) => {
    showDialog({
      title,
      message,
      dismissOnBackdropPress: true,
      buttons: [
        {
          label: 'Sign Up',
          variant: 'primary',
          onPress: () => {
            router.push('/(auth)/register');
          },
        },
        {
          label: 'Log In',
          variant: 'secondary',
          onPress: () => {
            router.push('/(auth)/login');
          },
        },
      ],
    });
  };

  const handleOpenProfile = () => {
    if (isGuest) {
      promptGuestAuth(
        'Access Profile',
        'Sign up or log in to view your profile, track training history, and unlock achievements.',
      );
      return;
    }
    router.push('/(tabs)/profile');
  };

  const handleOpenNotifications = () => {
    if (isGuest) {
      promptGuestAuth(
        'Access Notifications',
        'Sign up or log in to view your notifications and stay updated on classes, rewards, and academy news.',
      );
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
      <DrawerMenu visible={drawerOpen} onClose={() => setDrawerOpen(false)} blurTargetRef={blurTargetRef} />
    </>
  );
}
