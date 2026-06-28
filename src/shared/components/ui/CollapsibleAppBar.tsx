import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';
import {
  APP_BAR_SIDE_SLOT_WIDTH,
  getAppBarTitleStyle,
} from './appBarShared';
import { AppBarBackButton, AppBarIconButton, appBarButtonStyles } from './AppBarBackButton';

type CollapsibleAppBarProps = {
  title: string;
  scrollY: SharedValue<number>;
  collapseStart: number;
  collapseEnd: number;
  onBackPress?: () => void;
  rightElement?: React.ReactNode;
};

function useCollapsibleAppBarIconLayers(
  scrollY: SharedValue<number>,
  collapseStart: number,
  collapseEnd: number,
) {
  const heroIconOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, collapseStart], [1, 0], Extrapolation.CLAMP),
  }));

  const solidIconOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [collapseStart, collapseEnd],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return { heroIconOpacity, solidIconOpacity };
}

/**
 * Hero-style app bar that morphs into the standard push `AppBar` as the user scrolls.
 */
export function CollapsibleAppBar({
  title,
  scrollY,
  collapseStart,
  collapseEnd,
  onBackPress,
  rightElement,
}: CollapsibleAppBarProps) {
  const theme = useTheme();
  const { colors, inset, layout } = theme;
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();
  const iconLayers = useCollapsibleAppBarIconLayers(scrollY, collapseStart, collapseEnd);

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
      return;
    }
    router.back();
  };

  const shellStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollY.value,
      [collapseStart, collapseEnd],
      ['transparent', colors.background.primary],
    ),
    borderBottomColor: interpolateColor(
      scrollY.value,
      [collapseStart, collapseEnd],
      ['transparent', colors.border.subtle],
    ),
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [collapseEnd - 30, collapseEnd + 20],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const backSurfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollY.value,
      [0, collapseStart],
      ['rgba(0,0,0,0.40)', colors.background.secondary],
    ),
  }));

  const barHeight = layout.headerHeight;

  return (
    <Animated.View
      style={[
        styles.shell,
        {
          alignItems: 'center',
          flexDirection: 'row',
          height: barHeight + safeInsets.top,
          justifyContent: 'space-between',
          paddingHorizontal: inset.md,
          paddingTop: safeInsets.top,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
        shellStyle,
      ]}
    >
      <View style={[appBarButtonStyles.sideSlot, appBarButtonStyles.sideSlotStart]}>
        <AppBarBackButton
          onPress={handleBack}
          surfaceStyle={backSurfaceStyle}
          animatedIconLayers={{
            heroOpacityStyle: iconLayers.heroIconOpacity,
            solidOpacityStyle: iconLayers.solidIconOpacity,
          }}
        />
      </View>

      <Animated.Text
        numberOfLines={1}
        style={[styles.title, getAppBarTitleStyle(theme), titleStyle]}
      >
        {title}
      </Animated.Text>

      <View style={[appBarButtonStyles.sideSlot, appBarButtonStyles.sideSlotEnd]}>
        {rightElement ?? <View style={styles.rightPlaceholder} />}
      </View>
    </Animated.View>
  );
}

type CollapsibleAppBarActionProps = {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  scrollY: SharedValue<number>;
  collapseStart: number;
  collapseEnd: number;
};

export function CollapsibleAppBarAction({
  icon,
  onPress,
  accessibilityLabel,
  scrollY,
  collapseStart,
  collapseEnd,
}: CollapsibleAppBarActionProps) {
  const { colors } = useTheme();
  const iconLayers = useCollapsibleAppBarIconLayers(scrollY, collapseStart, collapseEnd);

  const surfaceStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      scrollY.value,
      [0, collapseStart],
      ['rgba(0,0,0,0.40)', colors.background.secondary],
    ),
  }));

  return (
    <AppBarIconButton
      icon={icon}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      surfaceStyle={surfaceStyle}
      animatedIconLayers={{
        heroOpacityStyle: iconLayers.heroIconOpacity,
        solidOpacityStyle: iconLayers.solidIconOpacity,
      }}
    />
  );
}

const styles = StyleSheet.create({
  shell: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
  title: {
    flex: 1,
    flexShrink: 1,
  },
  rightPlaceholder: {
    width: APP_BAR_SIDE_SLOT_WIDTH,
  },
});
