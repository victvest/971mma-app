import React, { useEffect, useMemo } from 'react';
import { Tabs, useRouter, useSegments } from 'expo-router';
import { APP_TAB_ROUTES, FloatingTabBar } from '@/shared/components/navigation/FloatingTabBar';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useAccountActionSheet } from '@/shared/hooks/useAccountActionSheet';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
import { createTabScreenOptions } from '@/shared/navigation/tabScreenOptions';
import { resolveGuestTabAction } from '@/shared/navigation/guestTabAccess';
import { useIsViewingChildProfile, useActiveGuardianLink } from '@/hooks/useActiveMemberId';

type TabRoute = {
  key: string;
  name: string;
};

type TabBarState = {
  index: number;
  routes: TabRoute[];
};

type TabBarNavigation = {
  emit: (event: {
    type: 'tabPress' | 'tabLongPress';
    target: string;
    canPreventDefault?: boolean;
  }) => unknown;
  navigate: (name: string) => void;
};

type TabBarProps = {
  state: TabBarState;
  navigation: TabBarNavigation;
};

function CustomTabBar({ state, navigation }: TabBarProps) {
  const activeRouteName = state.routes[state.index]?.name;
  const viewingChild = useIsViewingChildProfile();
  const activeGuardianLink = useActiveGuardianLink();
  const { isAnonymousGuest, needsActivation } = useIsGuest();
  const { prompt, sheet } = useAccountActionSheet();
  const routes = useMemo(
    () =>
      viewingChild
        ? APP_TAB_ROUTES.filter((route) => route.name === 'index' || route.name === 'checkin')
        : APP_TAB_ROUTES,
    [viewingChild],
  );

  return (
    <>
      <FloatingTabBar
        routes={routes}
        activeRouteName={activeRouteName}
        onRoutePress={(route) => {
          const guestAction = resolveGuestTabAction({
            routeName: route.name,
            isAnonymousGuest,
            needsActivation,
          });
          if (guestAction) {
            triggerSelectionHaptic();
            prompt(guestAction);
            return;
          }

          const target = state.routes.find((item) => item.name === route.name);
          if (!target) return;

          const event = navigation.emit({
            type: 'tabPress',
            target: target.key,
            canPreventDefault: true,
          }) as { defaultPrevented?: boolean };

          if (activeRouteName !== route.name && !event.defaultPrevented) {
            triggerSelectionHaptic();
            navigation.navigate(route.name);
          }
        }}
        onRouteLongPress={(route) => {
          const target = state.routes.find((item) => item.name === route.name);
          if (!target) return;

          navigation.emit({
            type: 'tabLongPress',
            target: target.key,
          });
        }}
        hideWhenInactive
      />
      {sheet}
    </>
  );
}

export default function MainTabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  const viewingChild = useIsViewingChildProfile();
  const activeTab =
    (segments as string[]).filter((segment) => !segment.startsWith('(')).at(-1) || 'index';

  const activeGuardianLink = useActiveGuardianLink();

  useEffect(() => {
    if (!viewingChild) return;
    if (activeTab === 'schedule' || activeTab === 'coaches' || activeTab === 'feed') {
      router.replace('/(tabs)');
    }
  }, [activeTab, router, viewingChild]);

  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={createTabScreenOptions()}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Classes',
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
        }}
      />
      <Tabs.Screen
        name="checkin"
        options={{
          title: 'Check-in',
        }}
      />
      <Tabs.Screen
        name="coaches"
        options={{
          title: 'Coaches',
        }}
      />
    </Tabs>
  );
}
