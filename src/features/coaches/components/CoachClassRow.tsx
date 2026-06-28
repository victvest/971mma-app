import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { parseScheduleCardTime } from '@/features/schedule/utils/formatScheduleTime';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import type { ClassItem } from '@/types/domain';

type Props = {
  item: ClassItem;
  onPress: (id: string) => void;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const CoachClassRow = React.memo(function CoachClassRow({ item, onPress }: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const { label, time } = parseScheduleCardTime(item.startsAt);
  const scale = useSharedValue<number>(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = useCallback(() => {
    triggerLightImpact();
    scale.value = withSpring(0.97, animations.spring.snappy);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, animations.spring.snappy);
  }, [scale]);

  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
      style={[
        styles.row,
        {
          backgroundColor: colors.background.elevated,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          padding: inset.md,
          gap: gap.md,
        },
        animatedStyle,
      ]}
    >
      <View
        style={[
          styles.timeBox,
          {
            backgroundColor: colors.accent.subtle,
            borderColor: colors.accent.default + '33',
            borderRadius: radius.input,
            borderWidth: layout.borderWidth,
          },
        ]}
      >
        <Text style={[typography.textPresets.label, { color: colors.accent.pressed }]}>{label}</Text>
        <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>{time}</Text>
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
          {item.title}
        </Text>
        <Text numberOfLines={1} style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          {item.discipline}
          {item.level ? ` · ${item.level}` : ''}
        </Text>
      </View>
      <View style={[styles.chevron, { backgroundColor: colors.background.secondary, borderRadius: radius.pill }]}>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  timeBox: {
    alignItems: 'center',
    gap: 2,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  body: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  chevron: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
});
