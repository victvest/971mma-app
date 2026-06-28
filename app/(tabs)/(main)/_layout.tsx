import React from 'react';
import { Tabs } from 'expo-router';
import { APP_TAB_ROUTES, FloatingTabBar } from '@/shared/components/navigation/FloatingTabBar';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { createTabScreenOptions } from '@/shared/navigation/tabScreenOptions';

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

  return (
    <FloatingTabBar
      routes={APP_TAB_ROUTES}
      activeRouteName={activeRouteName}
      onRoutePress={(route) => {
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
  );
}

export default function MainTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={createTabScreenOptions()}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
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
