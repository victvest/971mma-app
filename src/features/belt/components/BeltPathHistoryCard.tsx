import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BeltPathSurfaceCard } from '@/features/belt/components/BeltPathSurfaceCard';
import { useTheme } from '@/shared/theme';
import type { PromotionItem } from '@/types/domain';

type Props = {
  promotions: PromotionItem[];
};

const MONTH_LABELS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

function formatPromotionDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTH_LABELS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatPromotionLine(promotion: PromotionItem): string {
  const fromLabel = promotion.fromRankName
    ? `${promotion.fromRankName} (${promotion.fromStripe ?? 0} stripes)`
    : 'Enrolled';
  const toLabel = `${promotion.toRankName ?? 'Unknown'} (${promotion.toStripe ?? 0} stripes)`;
  return `${fromLabel} → ${toLabel}`;
}

export function BeltPathHistoryCard({ promotions }: Props) {
  const { colors, typography, gap } = useTheme();

  return (
    <BeltPathSurfaceCard>
      {promotions.map((promotion, index) => {
        const isLast = index === promotions.length - 1;

        return (
          <View key={promotion.id} style={styles.entryRow}>
            <View style={styles.railCol}>
              <View
                style={[
                  styles.dot,
                  {
                    borderColor: colors.border.default,
                    backgroundColor: colors.surface.primary,
                  },
                ]}
              />
              {!isLast ? (
                <View style={[styles.line, { backgroundColor: colors.border.subtle }]} />
              ) : null}
            </View>

            <View style={[styles.content, { gap: gap.xs, paddingBottom: isLast ? 0 : gap.lg }]}>
              <Text
                style={[
                  typography.textPresets.caption,
                  styles.dateLabel,
                  { color: colors.text.tertiary },
                ]}
              >
                {formatPromotionDate(promotion.awardedAt)}
              </Text>
              <Text style={[typography.textPresets.body, { color: colors.text.primary }]}>
                {formatPromotionLine(promotion)}
              </Text>
            </View>
          </View>
        );
      })}
    </BeltPathSurfaceCard>
  );
}

const styles = StyleSheet.create({
  entryRow: {
    flexDirection: 'row',
    gap: 14,
  },
  railCol: {
    alignItems: 'center',
    paddingTop: 14,
    width: 16,
  },
  dot: {
    borderRadius: 999,
    borderWidth: 2,
    height: 10,
    width: 10,
  },
  line: {
    flex: 1,
    marginTop: 6,
    minHeight: 36,
    width: 2,
  },
  content: {
    flex: 1,
    paddingTop: 2,
  },
  dateLabel: {
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});
