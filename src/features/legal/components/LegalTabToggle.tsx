import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';

export type LegalTab = 'privacy' | 'terms';

type Props = {
  tab: LegalTab;
  onTabChange: (tab: LegalTab) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type SegmentProps = {
  label: string;
  selected: boolean;
  accessibilityLabel: string;
  onPress: () => void;
};

function Segment({ label, selected, accessibilityLabel, onPress }: SegmentProps) {
  const { colors, typography, radius, inset } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    triggerLightImpact();
    scale.value = withSpring(0.96, animations.spring.snappy);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
  }, [scale]);

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.segment,
        animatedStyle,
        {
          borderRadius: radius.pill,
          backgroundColor: selected ? colors.accent.default : 'transparent',
          paddingVertical: inset.sm,
          paddingHorizontal: inset.md,
        },
      ]}
    >
      <Text
        style={[
          typography.textPresets.bodyMedium,
          { color: selected ? colors.accent.onAccent : colors.text.secondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/** Pill segmented control — same structure as Check-in mode toggle, brand accent selected state. */
export function LegalTabToggle({ tab, onTabChange }: Props) {
  const { colors, radius, inset } = useTheme();

  const selectPrivacy = useCallback(() => onTabChange('privacy'), [onTabChange]);
  const selectTerms = useCallback(() => onTabChange('terms'), [onTabChange]);

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.track,
        {
          backgroundColor: colors.fill.secondary,
          borderRadius: radius.pill,
          padding: inset['2xs'],
          borderColor: colors.border.subtle,
          borderWidth: 1,
        },
      ]}
    >
      <Segment
        label="Privacy Policy"
        selected={tab === 'privacy'}
        accessibilityLabel="Privacy Policy"
        onPress={selectPrivacy}
      />
      <Segment
        label="Terms & Conditions"
        selected={tab === 'terms'}
        accessibilityLabel="Terms and Conditions"
        onPress={selectTerms}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
