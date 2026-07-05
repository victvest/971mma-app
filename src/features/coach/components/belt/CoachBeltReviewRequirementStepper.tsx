import React, { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedBarFill } from '@/shared/animations';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import type { BeltRequirementItem } from '@/types/domain';

type Props = {
  requirements: BeltRequirementItem[];
  trainingDays: number;
  updatingRequirementId: string | null;
  onMarkDone: (requirementId: string, title: string) => void;
};

type StepVisual = 'done' | 'active' | 'upcoming';

function stepVisual(status: BeltRequirementItem['status']): StepVisual {
  if (status === 'done') return 'done';
  if (status === 'now') return 'active';
  return 'upcoming';
}

function attendanceFraction(item: BeltRequirementItem, trainingDays: number): string | null {
  if (item.type !== 'attendance' || !item.attendanceTarget) return null;
  const current = Math.min(trainingDays, item.attendanceTarget);
  return `${current}/${item.attendanceTarget}`;
}

type StepNodeProps = {
  visual: StepVisual;
  isLast: boolean;
};

const StepNode = memo(function StepNode({ visual, isLast }: StepNodeProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.nodeColumn}>
      {visual === 'done' ? (
        <View style={[styles.node, { backgroundColor: colors.accent.default }]}>
          <Ionicons name="checkmark" size={12} color={colors.accent.onAccent} />
        </View>
      ) : visual === 'active' ? (
        <View style={[styles.node, styles.nodeRing, { borderColor: colors.accent.default }]} />
      ) : (
        <View style={[styles.node, styles.nodeRing, { borderColor: colors.border.subtle }]} />
      )}
      {!isLast ? (
        <View style={[styles.connector, { backgroundColor: colors.border.subtle }]} />
      ) : null}
    </View>
  );
});

type StepRowProps = {
  item: BeltRequirementItem;
  trainingDays: number;
  isLast: boolean;
  isUpdating: boolean;
  onMarkDone: (requirementId: string, title: string) => void;
};

const StepRow = memo(function StepRow({
  item,
  trainingDays,
  isLast,
  isUpdating,
  onMarkDone,
}: StepRowProps) {
  const { colors, typography, inset, gap } = useTheme();
  const visual = stepVisual(item.status);
  const isActive = item.status === 'now';
  const canMarkDone = item.type !== 'attendance' && isActive && !isUpdating;
  const fraction = attendanceFraction(item, trainingDays);

  const attendanceProgress = useMemo(() => {
    if (item.type !== 'attendance' || !item.attendanceTarget) return null;
    const current = Math.min(trainingDays, item.attendanceTarget);
    return Math.round((current / item.attendanceTarget) * 100);
  }, [item.attendanceTarget, item.type, trainingDays]);

  const handleMarkDone = useCallback(() => {
    triggerLightImpact();
    onMarkDone(item.id, item.title);
  }, [item.id, onMarkDone]);

  return (
    <View style={[styles.stepRow, { gap: gap.md, paddingBottom: isLast ? 0 : gap.lg }]}>
      <StepNode visual={visual} isLast={isLast} />

      <View style={[styles.stepContent, { gap: gap.sm, paddingBottom: inset.xs }]}>
        <View style={styles.titleRow}>
          <Text
            style={[
              typography.textPresets.bodyMedium,
              {
                color:
                  visual === 'upcoming'
                    ? colors.text.tertiary
                    : visual === 'done'
                      ? colors.text.secondary
                      : colors.text.primary,
                flex: 1,
                fontWeight:
                  visual === 'active'
                    ? typography.fontWeight.semibold
                    : typography.fontWeight.medium,
              },
            ]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {fraction ? (
            <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
              {fraction}
            </Text>
          ) : null}
        </View>

        {attendanceProgress !== null && visual !== 'upcoming' ? (
          <AnimatedBarFill
            percent={attendanceProgress}
            backgroundColor={colors.accent.pressed}
            highlightColor={colors.accent.default}
            isHighlighted={isActive}
            trackColor={colors.fill.secondary}
            trackHeight={4}
            minFillHeight={item.status === 'done' ? 4 : 3}
          />
        ) : null}

        {canMarkDone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mark requirement done"
            onPress={handleMarkDone}
            hitSlop={8}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            {isUpdating ? (
              <ActivityIndicator size="small" color={colors.accent.default} />
            ) : (
              <Text style={[typography.textPresets.footnote, { color: colors.accent.default }]}>
                Mark done
              </Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

export const CoachBeltReviewRequirementStepper = memo(function CoachBeltReviewRequirementStepper({
  requirements,
  trainingDays,
  updatingRequirementId,
  onMarkDone,
}: Props) {
  const { colors, typography, gap } = useTheme();

  if (requirements.length === 0) {
    return (
      <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
        No active requirements for this stripe yet.
      </Text>
    );
  }

  return (
    <View style={{ gap: gap.md }}>
      <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
        Requirements
      </Text>
      <View>
        {requirements.map((item, index) => (
          <StepRow
            key={item.id}
            item={item}
            trainingDays={trainingDays}
            isLast={index === requirements.length - 1}
            isUpdating={updatingRequirementId === item.id}
            onMarkDone={onMarkDone}
          />
        ))}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  stepRow: {
    flexDirection: 'row',
  },
  nodeColumn: {
    alignItems: 'center',
    width: 20,
  },
  node: {
    alignItems: 'center',
    borderRadius: 10,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  nodeRing: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  connector: {
    flex: 1,
    marginVertical: 4,
    minHeight: 20,
    width: 1,
  },
  stepContent: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
});
