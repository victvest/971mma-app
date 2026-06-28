import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';
import { APP_BAR_SIDE_SLOT_WIDTH } from './appBarShared';
import { GlassNavChrome } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';

type AnimatedIconLayers = {
  heroOpacityStyle: AnimatedStyle<ViewStyle>;
  solidOpacityStyle: AnimatedStyle<ViewStyle>;
};

type AppBarBackButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  surfaceStyle?: AnimatedStyle<ViewStyle>;
  iconColor?: string;
  animatedIconLayers?: AnimatedIconLayers;
};

function AppBarIconLayers({
  name,
  size,
  heroColor,
  solidColor,
  layers,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size: number;
  heroColor: string;
  solidColor: string;
  layers: AnimatedIconLayers;
}) {
  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, appBarButtonStyles.iconLayer, layers.heroOpacityStyle]}>
        <Ionicons name={name} size={size} color={heroColor} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, appBarButtonStyles.iconLayer, layers.solidOpacityStyle]}>
        <Ionicons name={name} size={size} color={solidColor} />
      </Animated.View>
    </>
  );
}

export function AppBarBackButton({
  onPress,
  accessibilityLabel = 'Go back',
  surfaceStyle,
  iconColor,
  animatedIconLayers,
}: AppBarBackButtonProps) {
  const resolvedIconColor = iconColor ?? UAE.ink;

  const chrome = (
    <GlassNavChrome
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      borderRadius={NAV_CHROME.glassRadius}
      contentStyle={{ width: NAV_CHROME.clusterHeight, height: NAV_CHROME.clusterHeight }}
    >
      {animatedIconLayers ? (
        <AppBarIconLayers
          name="chevron-back"
          size={NAV_CHROME.iconSize}
          heroColor="#FFFFFF"
          solidColor={resolvedIconColor}
          layers={animatedIconLayers}
        />
      ) : (
        <Ionicons name="chevron-back" size={NAV_CHROME.iconSize} color={resolvedIconColor} />
      )}
    </GlassNavChrome>
  );

  if (!surfaceStyle) {
    return chrome;
  }

  return (
    <Animated.View
      style={[
        surfaceStyle,
        {
          borderRadius: NAV_CHROME.glassRadius,
          overflow: 'hidden',
        },
      ]}
    >
      {chrome}
    </Animated.View>
  );
}

export function AppBarIconButton({
  icon,
  onPress,
  accessibilityLabel,
  surfaceStyle,
  iconColor,
  animatedIconLayers,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  surfaceStyle?: AnimatedStyle<ViewStyle>;
  iconColor?: string;
  animatedIconLayers?: AnimatedIconLayers;
}) {
  const resolvedIconColor = iconColor ?? UAE.ink;

  const chrome = (
    <GlassNavChrome
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      borderRadius={NAV_CHROME.glassRadius}
      contentStyle={{ width: NAV_CHROME.clusterHeight, height: NAV_CHROME.clusterHeight }}
    >
      {animatedIconLayers ? (
        <AppBarIconLayers
          name={icon}
          size={NAV_CHROME.iconSize}
          heroColor="#FFFFFF"
          solidColor={resolvedIconColor}
          layers={animatedIconLayers}
        />
      ) : (
        <Ionicons name={icon} size={NAV_CHROME.iconSize} color={resolvedIconColor} />
      )}
    </GlassNavChrome>
  );

  if (!surfaceStyle) {
    return chrome;
  }

  return (
    <Animated.View
      style={[
        surfaceStyle,
        {
          borderRadius: NAV_CHROME.glassRadius,
          overflow: 'hidden',
        },
      ]}
    >
      {chrome}
    </Animated.View>
  );
}

export const appBarButtonStyles = StyleSheet.create({
  sideSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: APP_BAR_SIDE_SLOT_WIDTH,
  },
  sideSlotStart: {
    alignItems: 'flex-start',
  },
  sideSlotEnd: {
    alignItems: 'flex-end',
  },
  iconLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
