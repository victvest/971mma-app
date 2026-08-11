import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { CoachCurriculumRequirement } from '@/types/domain';

type Props = {
  item: CoachCurriculumRequirement;
  onEdit: (item: CoachCurriculumRequirement) => void;
  onDelete: (item: CoachCurriculumRequirement) => void;
};

function formatTypeLabel(item: CoachCurriculumRequirement): string {
  if (item.requirementType === 'attendance' && item.attendanceTarget) {
    return `${item.attendanceTarget} classes`;
  }
  return item.requirementType;
}

export const CoachCurriculumRequirementCard = memo(function CoachCurriculumRequirementCard({
  item,
  onEdit,
  onDelete,
}: Props) {
  const { colors, typography, inset, gap, radius, surfaceShadow, layout } = useTheme();

  const handleEdit = useCallback(() => {
    triggerLightImpact();
    onEdit(item);
  }, [item, onEdit]);

  const handleDelete = useCallback(() => {
    triggerLightImpact();
    onDelete(item);
  }, [item, onDelete]);

  return (
    <View
      style={[
        styles.card,
        surfaceShadow('card'),
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.card,
          borderWidth: layout.borderWidth,
          padding: inset.md,
          gap: gap.sm,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text
          style={[typography.textPresets.bodyMedium, styles.title, { color: colors.text.primary }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <View style={[styles.actions, { gap: gap.xs }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit requirement"
            onPress={handleEdit}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.fill.secondary,
                borderRadius: radius.pill,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="create-outline" size={16} color={colors.text.secondary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete requirement"
            onPress={handleDelete}
            hitSlop={8}
            style={({ pressed }) => [
              styles.iconButton,
              {
                backgroundColor: colors.status.errorSubtle,
                borderRadius: radius.pill,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.status.error} />
          </Pressable>
        </View>
      </View>

      {item.description ? (
        <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
          {item.description}
        </Text>
      ) : null}

      <View
        style={[
          styles.typeChip,
          {
            alignSelf: 'flex-start',
            backgroundColor: colors.accent.subtle,
            borderRadius: radius.tag,
            paddingHorizontal: inset.sm,
            paddingVertical: inset.xs,
          },
        ]}
      >
        <Text style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}>
          {formatTypeLabel(item)}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {},
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  title: {
    flex: 1,
    fontWeight: '600',
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  iconButton: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  typeChip: {},
});
