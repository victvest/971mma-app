import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ScheduleCategoryIcon } from '@/features/schedule/components/ScheduleCategoryIcon';
import {
  type ScheduleCategory,
} from '@/features/schedule/utils/scheduleCategory';
import { AppScrollView } from '@/shared/components/ui';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';

type ScheduleFilterOption = {
  value: ScheduleCategory;
  label: string;
};

type ScheduleFilterBarProps = {
  options: ScheduleFilterOption[];
  selected: string | null;
  onSelect: (value: string | null) => void;
};

type FilterChipProps = {
  label: string;
  category: ScheduleCategory | 'all';
  value: string | null;
  selected: boolean;
  onSelect: (value: string | null) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const FilterChip = memo(function FilterChip({
  label,
  category,
  value,
  selected,
  onSelect,
}: FilterChipProps) {
  const { colors } = useTheme();
  const scale = useSharedValue<number>(1);
  const opacity = useSharedValue<number>(1);
  const iconColor = selected ? colors.accent.onAccent : colors.text.secondary;

  const handlePress = useCallback(() => {
    triggerSelectionHaptic();
    onSelect(value);
  }, [onSelect, value]);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, animations.spring.snappy);
    opacity.value = withTiming(0.9, animations.timing.press);
  }, [opacity, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
    opacity.value = withTiming(1, animations.timing.press);
  }, [opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={label}
      style={[
        styles.chip,
        selected
          ? {
              backgroundColor: colors.accent.default,
              borderColor: colors.accent.default,
            }
          : {
              backgroundColor: colors.background.secondary,
              borderColor: colors.border.default,
            },
        animatedStyle,
      ]}
    >
      <View style={styles.chipContent}>
        <ScheduleCategoryIcon category={category} color={iconColor} />
        <Text
          numberOfLines={1}
          style={[
            styles.chipLabel,
            { color: selected ? colors.accent.onAccent : colors.text.primary },
          ]}
        >
          {label}
        </Text>
      </View>
    </AnimatedPressable>
  );
});

function updateFadeVisibility(
  offsetX: number,
  viewportWidth: number,
  contentWidth: number,
): boolean {
  if (contentWidth <= viewportWidth + 1) {
    return false;
  }
  return offsetX + viewportWidth < contentWidth - 4;
}

export function ScheduleFilterBar({ options, selected, onSelect }: ScheduleFilterBarProps) {
  const { colors, inset } = useTheme();
  const [showRightFade, setShowRightFade] = useState(true);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);

  const fadeColors = useMemo(
    () =>
      [
        `${colors.background.primary}00`,
        `${colors.background.primary}D0`,
        colors.background.primary,
      ] as const,
    [colors.background.primary],
  );

  const syncFade = useCallback(
    (nextOffsetX: number, nextViewportWidth: number, nextContentWidth: number) => {
      // Keep visible while dimensions are unknown; hide only when confirmed no overflow or at end.
      if (nextViewportWidth === 0 || nextContentWidth === 0) return;
      setShowRightFade(updateFadeVisibility(nextOffsetX, nextViewportWidth, nextContentWidth));
    },
    [],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      setViewportWidth(width);
      syncFade(scrollX, width, contentWidth);
    },
    [contentWidth, scrollX, syncFade],
  );

  const handleContentSizeChange = useCallback(
    (width: number) => {
      setContentWidth(width);
      syncFade(scrollX, viewportWidth, width);
    },
    [scrollX, syncFade, viewportWidth],
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextOffsetX = event.nativeEvent.contentOffset.x;
      setScrollX(nextOffsetX);
      syncFade(nextOffsetX, viewportWidth, contentWidth);
    },
    [contentWidth, syncFade, viewportWidth],
  );

  return (
    <View style={[styles.wrap, { marginHorizontal: -inset.lg }]} onLayout={handleLayout}>
      <AppScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={handleContentSizeChange}
        contentContainerStyle={[styles.content, { paddingHorizontal: inset.lg }]}
      >
        <FilterChip
          label="All"
          category="all"
          value={null}
          selected={!selected}
          onSelect={onSelect}
        />
        {options.map((option) => (
          <FilterChip
            key={option.value}
            label={option.label}
            category={option.value}
            value={option.value}
            selected={selected === option.value}
            onSelect={onSelect}
          />
        ))}
      </AppScrollView>

      {showRightFade ? (
        <LinearGradient
          pointerEvents="none"
          colors={fadeColors}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.fadeRight}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
    justifyContent: 'center',
    maxWidth: 200,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  fadeRight: {
    bottom: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    width: 72,
  },
});
