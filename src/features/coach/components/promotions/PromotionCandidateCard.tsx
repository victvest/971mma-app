import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { useTheme } from '@/shared/theme';
import type { PromotionCandidateItem } from '@/types/domain';

/** Card height + list gap — used by ScrollRevealCard stride math. */
export const PROMOTION_CANDIDATE_ITEM_HEIGHT = 172;

const STAT_VALUE_MIN_HEIGHT = 32;
const STAT_LABEL_MIN_HEIGHT = 30;

function reasonLabel(reason: PromotionCandidateItem['candidateReason']): string {
  if (reason === 'ready_for_stripe') return 'Ready to promote';
  if (reason === 'near_ready') return 'Near ready';
  return 'Tracking';
}

function getReadinessTreatment(
  reason: PromotionCandidateItem['candidateReason'],
  colors: ReturnType<typeof useTheme>['colors'],
) {
  if (reason === 'ready_for_stripe') {
    return {
      bg: colors.accent.default,
      text: colors.accent.onAccent,
    };
  }
  return {
    bg: colors.status.warning,
    text: colors.text.inverse,
  };
}

type StatCellProps = {
  value: React.ReactNode;
  label: string;
};

const StatCell = memo(function StatCell({ value, label }: StatCellProps) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={styles.statCell}>
      <View style={[styles.statValueSlot, { minHeight: STAT_VALUE_MIN_HEIGHT }]}>
        {typeof value === 'string' ? (
          <Text
            style={[typography.textPresets.metricValue, { color: colors.text.primary }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
      <View style={[styles.statLabelSlot, { minHeight: STAT_LABEL_MIN_HEIGHT, marginTop: gap.xs }]}>
        <Text
          style={[
            typography.textPresets.metricLabel,
            styles.statLabelText,
            { color: colors.text.tertiary },
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </View>
  );
});

type Props = {
  item: PromotionCandidateItem;
  onPress: () => void;
};

export const PromotionCandidateCard = memo(function PromotionCandidateCard({ item, onPress }: Props) {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const treatment = getReadinessTreatment(item.candidateReason, colors);
  const isComplete = item.percent >= 100;
  const handlePress = useCallback(() => onPress(), [onPress]);

  return (
    <HomeAnimatedPressable
      onPress={handlePress}
      accessibilityLabel={item.fullName}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderWidth: layout.borderWidth,
          borderRadius: radius.cardLarge,
          padding: inset.lg,
          marginBottom: gap.md,
        },
      ]}
    >
      <View style={[styles.cardHeader, { gap: gap.sm }]}>
        <View style={styles.nameArea}>
          <Text
            style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}
            numberOfLines={1}
          >
            {item.fullName}
          </Text>
          <Text
            style={[
              typography.textPresets.caption,
              { color: colors.text.secondary, marginTop: gap.xs },
            ]}
            numberOfLines={1}
          >
            {item.beltRank ?? 'Unranked'} · stripe {item.beltStripes}
          </Text>
        </View>

        <View
          style={[
            styles.readinessBadge,
            {
              backgroundColor: treatment.bg,
              borderRadius: radius.badge,
              paddingHorizontal: inset.sm,
              paddingVertical: inset.xs,
            },
          ]}
        >
          <Text
            style={[typography.textPresets.captionMedium, { color: treatment.text }]}
            numberOfLines={1}
          >
            {reasonLabel(item.candidateReason)}
          </Text>
        </View>
      </View>

      <View style={[styles.statsRow, { marginTop: inset.md }]}>
        <StatCell
          value={
            <Text
              style={[
                typography.textPresets.metricValue,
                { color: isComplete ? colors.accent.default : colors.text.primary },
              ]}
            >
              {item.percent.toFixed(0)}
              <Text style={[typography.textPresets.callout, { color: colors.text.secondary }]}>
                %
              </Text>
            </Text>
          }
          label="COMPLETE"
        />
        <View style={[styles.statDivider, { backgroundColor: colors.border.subtle }]} />
        <StatCell value={String(item.trainingDays)} label="TRAINING DAYS" />
        <View style={[styles.statDivider, { backgroundColor: colors.border.subtle }]} />
        <StatCell value={String(item.recentCheckIns)} label="CHECK-INS" />
      </View>
    </HomeAnimatedPressable>
  );
});

const styles = StyleSheet.create({
  card: {},
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nameArea: {
    flex: 1,
    minWidth: 0,
  },
  readinessBadge: {
    flexShrink: 0,
  },
  statsRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  statValueSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  statLabelSlot: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  statLabelText: {
    textAlign: 'center',
  },
  statDivider: {
    alignSelf: 'stretch',
    width: StyleSheet.hairlineWidth,
  },
});
