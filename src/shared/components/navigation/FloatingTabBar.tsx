import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LiquidGlassSurface } from '@/shared/components/ui/LiquidGlassSurface';
import { FLOATING_CHROME_ELEVATION } from '@/features/home/components/navigation/floatingChromeElevation';
import {
  glassChromeTint,
  glassIconHalo,
  glassLabelHalo,
  glassTabActiveCapsule,
  glassTabActiveForeground,
} from '@/features/home/components/navigation/glassChromeLegibility';
import { UAE } from '@/features/home/components/navigation/uaeChrome';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTheme } from '@/shared/theme';

export type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export type TabRouteConfig = {
  name: string;
  href: Href;
  label: string;
  icon: IoniconName;
  activeIcon: IoniconName;
};

export type AppTabRouteName = 'index' | 'schedule' | 'checkin' | 'belt-path' | 'coaches';

export type AppTabRoute = TabRouteConfig & {
  name: AppTabRouteName;
};

export const APP_TAB_ROUTES = [
  {
    name: 'index',
    href: '/(tabs)',
    label: 'Home',
    icon: 'home-outline',
    activeIcon: 'home',
  },
  {
    name: 'schedule',
    href: '/(tabs)/schedule',
    label: 'Schedule',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  {
    name: 'checkin',
    href: '/(tabs)/checkin',
    label: 'Check-in',
    icon: 'qr-code-outline',
    activeIcon: 'qr-code',
  },
  {
    name: 'coaches',
    href: '/(tabs)/coaches',
    label: 'Coaches',
    icon: 'person-outline',
    activeIcon: 'person',
  },
] as const satisfies readonly AppTabRoute[];

type FloatingTabActiveCapsuleProps = {
  activeIndex: number;
  tabCount: number;
  rowWidth: number;
  capsuleInset: number;
  capsuleRadius: number;
  mode: 'light' | 'dark';
};

const FloatingTabActiveCapsule = memo(function FloatingTabActiveCapsule({
  activeIndex,
  tabCount,
  rowWidth,
  capsuleInset,
  capsuleRadius,
  mode,
}: FloatingTabActiveCapsuleProps) {
  const { animations } = useTheme();
  const translateX = useSharedValue(0);
  const hasPositioned = useRef(false);

  const tabWidth = rowWidth > 0 ? rowWidth / tabCount : 0;
  const capsuleWidth = Math.max(0, tabWidth - capsuleInset * 2);

  useEffect(() => {
    if (rowWidth <= 0 || activeIndex < 0) return;

    const targetX = activeIndex * tabWidth + capsuleInset;

    if (!hasPositioned.current) {
      translateX.value = targetX;
      hasPositioned.current = true;
      return;
    }

    translateX.value = withSpring(targetX, animations.motion.tabBar.capsule);
  }, [
    activeIndex,
    animations.motion.tabBar.capsule,
    capsuleInset,
    rowWidth,
    tabWidth,
    translateX,
  ]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  if (activeIndex < 0 || rowWidth <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.activeCapsule,
        {
          top: capsuleInset,
          width: capsuleWidth,
          bottom: capsuleInset,
        },
        glassTabActiveCapsule(mode, capsuleRadius),
        animatedStyle,
      ]}
    />
  );
});

type FloatingTabButtonProps = {
  route: TabRouteConfig;
  isFocused: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

const FloatingTabButton = memo(function FloatingTabButton({
  route,
  isFocused,
  onPress,
  onLongPress,
}: FloatingTabButtonProps) {
  const { typography, gap, layout, animations, mode } = useTheme();
  const inactiveColor = mode === 'dark' ? '#F0F0ED' : UAE.ink;
  const activeColor = glassTabActiveForeground(mode);
  const foregroundColor = isFocused ? activeColor : inactiveColor;
  const focusScale = useSharedValue(isFocused ? 1.06 : 1);

  useEffect(() => {
    focusScale.value = withSpring(
      isFocused ? 1.06 : 1,
      animations.motion.tabBar.iconFocus,
    );
  }, [animations.motion.tabBar.iconFocus, focusScale, isFocused]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: focusScale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={route.label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.tabButton,
        { opacity: pressed ? animations.alpha.pressed : animations.alpha.visible },
      ]}
    >
      <View style={[styles.tabInner, { gap: gap.xs }]}>
        <Animated.View style={[isFocused ? undefined : glassIconHalo(mode), iconAnimatedStyle]}>
          <Ionicons
            name={isFocused ? route.activeIcon : route.icon}
            size={layout.tabIconSize}
            color={foregroundColor}
          />
        </Animated.View>
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            typography.textPresets.captionMedium,
            styles.tabLabel,
            !isFocused ? glassLabelHalo(mode) : null,
            {
              color: foregroundColor,
              fontWeight: isFocused ? typography.fontWeight.bold : typography.fontWeight.semibold,
            },
          ]}
        >
          {route.label}
        </Text>
      </View>
    </Pressable>
  );
});

type FloatingTabBarProps = {
  routes: readonly TabRouteConfig[];
  activeRouteName: string | undefined;
  onRoutePress: (route: TabRouteConfig) => void;
  onRouteLongPress?: (route: TabRouteConfig) => void;
  hideWhenInactive?: boolean;
};

export function FloatingTabBar({
  routes,
  activeRouteName,
  onRoutePress,
  onRouteLongPress,
  hideWhenInactive = true,
}: FloatingTabBarProps) {
  const { mode } = useTheme();
  const { tabBar } = useResponsiveLayout();
  const [rowWidth, setRowWidth] = useState(0);
  const activeIndex = routes.findIndex((route) => route.name === activeRouteName);

  const handlePress = useCallback(
    (route: TabRouteConfig) => {
      onRoutePress(route);
    },
    [onRoutePress],
  );

  const handleLongPress = useCallback(
    (route: TabRouteConfig) => {
      onRouteLongPress?.(route);
    },
    [onRouteLongPress],
  );

  const handleRowLayout = useCallback((event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  }, []);

  if (hideWhenInactive && activeIndex < 0) return null;

  return (
    <View
      style={[
        styles.tabBarContainer,
        FLOATING_CHROME_ELEVATION,
        {
          bottom: tabBar.bottom,
          height: tabBar.height,
          left: tabBar.horizontalInset,
          right: tabBar.horizontalInset,
          borderRadius: tabBar.radius,
        },
      ]}
    >
      <LiquidGlassSurface
        variant="chrome"
        tintColor={glassChromeTint(mode)}
        borderRadius={tabBar.radius}
        style={styles.glassFill}
        contentStyle={[styles.tabBarContent, { paddingHorizontal: tabBar.innerPadding }]}
      >
        <View style={styles.tabRow} onLayout={handleRowLayout}>
          <FloatingTabActiveCapsule
            activeIndex={activeIndex}
            tabCount={routes.length}
            rowWidth={rowWidth}
            capsuleInset={tabBar.capsuleInset}
            capsuleRadius={tabBar.capsuleRadius}
            mode={mode}
          />

          {routes.map((route) => {
            const isFocused = route.name === activeRouteName;
            return (
              <FloatingTabButton
                key={route.name}
                route={route}
                isFocused={isFocused}
                onPress={() => handlePress(route)}
                onLongPress={onRouteLongPress ? () => handleLongPress(route) : undefined}
              />
            );
          })}
        </View>
      </LiquidGlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: 'transparent',
    position: 'absolute',
  },
  glassFill: {
    flex: 1,
  },
  tabBarContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  tabRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
    width: '100%',
  },
  activeCapsule: {
    left: 0,
    position: 'absolute',
    zIndex: 0,
  },
  tabButton: {
    alignItems: 'center',
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    minWidth: 0,
    zIndex: 1,
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    paddingHorizontal: 2,
    textAlign: 'center',
    width: '100%',
  },
});
