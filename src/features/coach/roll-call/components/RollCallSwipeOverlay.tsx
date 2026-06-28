import React, { memo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import {
  rollCallAbsentOverlayOpacity,
  rollCallPresentOverlayOpacity,
  rollCallSwipeThreshold,
} from '@/features/coach/roll-call/utils/rollCallGestures';
import { useTheme } from '@/shared/theme';

type StampProps = {
  label: string;
  borderColor: string;
  textColor: string;
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  side: 'left' | 'right';
};

const CommitStamp = memo(function CommitStamp({
  label,
  borderColor,
  textColor,
  animatedStyle,
  side,
}: StampProps) {
  const { typography, radius, inset } = useTheme();

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.stamp,
        side === 'left' ? styles.stampLeft : styles.stampRight,
        animatedStyle,
        {
          borderColor,
          borderRadius: radius.card,
          paddingHorizontal: inset.md,
          paddingVertical: inset.sm,
        },
      ]}
    >
      <Text style={[typography.textPresets.label, styles.stampText, { color: textColor }]}>
        {label}
      </Text>
    </Animated.View>
  );
});

type Props = {
  translateX: SharedValue<number>;
  screenWidth: number;
};

export const RollCallSwipeOverlay = memo(function RollCallSwipeOverlay({
  translateX,
  screenWidth,
}: Props) {
  const { colors } = useTheme();

  const presentStampStyle = useAnimatedStyle(() => {
    const progress = rollCallPresentOverlayOpacity(translateX.value, screenWidth);
    const threshold = rollCallSwipeThreshold(screenWidth);
    const visible = threshold > 0 && translateX.value > threshold * 0.72 ? progress : 0;
    return {
      opacity: visible,
      transform: [{ scale: 0.94 + visible * 0.08 }],
    };
  });

  const absentStampStyle = useAnimatedStyle(() => {
    const progress = rollCallAbsentOverlayOpacity(translateX.value, screenWidth);
    const threshold = rollCallSwipeThreshold(screenWidth);
    const visible = threshold > 0 && translateX.value < -threshold * 0.72 ? progress : 0;
    return {
      opacity: visible,
      transform: [{ scale: 0.94 + visible * 0.08 }],
    };
  });

  return (
    <>
      <CommitStamp
        label="NOT PRESENT"
        borderColor={colors.status.errorBorder}
        textColor={colors.status.error}
        animatedStyle={absentStampStyle}
        side="left"
      />
      <CommitStamp
        label="PRESENT"
        borderColor={colors.status.successBorder}
        textColor={colors.status.success}
        animatedStyle={presentStampStyle}
        side="right"
      />
    </>
  );
});

const styles = StyleSheet.create({
  stamp: {
    borderWidth: 2.5,
    position: 'absolute',
    top: '32%',
    zIndex: 3,
  },
  stampLeft: {
    left: 20,
    transform: [{ rotate: '-10deg' }],
  },
  stampRight: {
    right: 20,
    transform: [{ rotate: '10deg' }],
  },
  stampText: {
    letterSpacing: 1.4,
  },
});
