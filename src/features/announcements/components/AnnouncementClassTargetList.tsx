import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatRollCallSummarySubtitle } from '@/features/coach/utils/classDisplay';
import { triggerSelectionHaptic } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CoachAnnouncementTargetClass } from '@/services/database/announcements.repository';

type Props = {
  classes: CoachAnnouncementTargetClass[];
  selectedIds: Set<string>;
  onToggle: (classId: string) => void;
};

export const AnnouncementClassTargetList = memo(function AnnouncementClassTargetList({
  classes,
  selectedIds,
  onToggle,
}: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();

  const handleToggle = useCallback(
    (classId: string) => {
      triggerSelectionHaptic();
      onToggle(classId);
    },
    [onToggle],
  );

  if (classes.length === 0) {
    return (
      <View
        style={[
          styles.empty,
          {
            backgroundColor: colors.surface.secondary,
            borderRadius: radius.card,
            padding: inset.md,
          },
        ]}
      >
        <Text style={[typography.textPresets.caption, { color: colors.text.secondary }]}>
          No classes scheduled today or tomorrow. Switch to General, or check back when your next
          sessions appear.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: gap.sm }}>
      {classes.map((item) => {
        const selected = selectedIds.has(item.id);
        const schedule = item.startsAt
          ? formatRollCallSummarySubtitle(item.title, item.startsAt)
          : item.title;
        const [, timePart] = schedule.split(' · ');

        return (
          <Pressable
            key={item.id}
            onPress={() => handleToggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${item.title}, ${item.rosterCount} on swipe list`}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.surface.primary,
                borderColor: selected ? colors.accent.default : colors.border.subtle,
                borderWidth: selected ? 2 : layout.borderWidth,
                borderRadius: radius.card,
                paddingHorizontal: inset.md,
                paddingVertical: inset.md,
                gap: gap.md,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Ionicons
              name={selected ? 'checkbox' : 'square-outline'}
              size={22}
              color={selected ? colors.accent.default : colors.text.tertiary}
            />
            <View style={styles.textBlock}>
              <Text
                numberOfLines={1}
                style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}
              >
                {item.title}
              </Text>
              <Text
                numberOfLines={1}
                style={[typography.textPresets.caption, { color: colors.text.secondary }]}
              >
                {timePart ?? item.discipline}
              </Text>
            </View>
            <View
              style={[
                styles.countChip,
                {
                  backgroundColor: colors.fill.secondary,
                  borderRadius: radius.badge,
                  paddingHorizontal: inset.sm,
                  paddingVertical: inset.xs,
                },
              ]}
            >
              <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
                {item.rosterCount} {item.rosterCount === 1 ? 'member' : 'members'}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  empty: {},
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  countChip: {},
});
