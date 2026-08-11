import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotiPressable } from '@/shared/animations';
import { AppScrollView } from '@/shared/components/ui';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { FeedDiscipline } from '@/features/feed/types';

type Props = {
  disciplines: FeedDiscipline[];
  selectedId: string | null;
  onSelect: (disciplineId: string | null) => void;
  /** When false, hides the browse-only "For you" pill (e.g. create-post must pick a category). */
  showAllOption?: boolean;
};

type FilterPillProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

const FilterPill = memo(function FilterPill({ label, active, onPress }: FilterPillProps) {
  const { colors, typography, radius, layout } = useTheme();
  return (
    <MotiPressable
      onPress={() => {
        triggerSelectionHaptic();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={active ? { selected: true } : undefined}
      style={[
        styles.pill,
        {
          borderRadius: radius.pill,
          borderColor: active ? colors.accent.default : colors.border.subtle,
          borderWidth: layout.borderWidth,
          backgroundColor: active ? colors.accent.default : colors.surface.primary,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          typography.textPresets.captionMedium,
          { color: active ? colors.accent.onAccent : colors.text.secondary },
        ]}
      >
        {label}
      </Text>
    </MotiPressable>
  );
});

export function FeedDisciplineFilter({
  disciplines,
  selectedId,
  onSelect,
  showAllOption = true,
}: Props) {
  const { gap, inset } = useTheme();
  const handleAll = useCallback(() => onSelect(null), [onSelect]);

  return (
    <View style={[styles.wrap, { marginHorizontal: -inset.lg }]}>
      <AppScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.content, { gap: gap.sm, paddingHorizontal: inset.lg }]}
      >
        {showAllOption ? (
          <FilterPill label="For you" active={!selectedId} onPress={handleAll} />
        ) : null}
        {disciplines.map((discipline) => (
          <FilterPill
            key={discipline.id}
            label={discipline.displayName}
            active={selectedId === discipline.id}
            onPress={() => onSelect(discipline.id)}
          />
        ))}
      </AppScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 0,
  },
  content: {
    paddingVertical: 2,
  },
  pill: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
});
