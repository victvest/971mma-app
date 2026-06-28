import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  formatRunClassRosterStat,
  formatRunClassSchedule,
} from '@/features/coach/utils/classDisplay';
import { formatDurationShort, isClassLiveNow } from '@/core/time/gymTime';
import { useTheme } from '@/shared/theme';
import type { ClassItem } from '@/types/domain';

const HERO_GRADIENT = ['#141F19', '#0A1310', '#070D0A'] as const;

type StatCellProps = {
  value: React.ReactNode;
  label: string;
};

const StatCell = memo(function StatCell({ value, label }: StatCellProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.statCell}>
      {typeof value === 'string' ? (
        <Text style={[styles.statValue, { color: colors.text.onPromo }]} numberOfLines={1}>
          {value}
        </Text>
      ) : (
        value
      )}
      <Text style={[styles.statLabel, { color: colors.text.onPromoMuted }]}>{label}</Text>
    </View>
  );
});

type Props = {
  classItem: ClassItem;
};

export const RunClassMetaCard = memo(function RunClassMetaCard({ classItem }: Props) {
  const { colors, typography, inset, radius, layout } = useTheme();

  const isLive = isClassLiveNow(classItem.startsAt, classItem.durationMinutes);
  const scheduleLabel = formatRunClassSchedule(classItem.startsAt);
  const rosterStat = formatRunClassRosterStat(classItem.bookedCount, classItem.capacity);

  return (
    <View
      style={[
        styles.cardShell,
        {
          borderColor: colors.border.onPromo,
          borderWidth: layout.borderWidth,
          borderRadius: radius.cardLarge,
        },
      ]}
    >
      <LinearGradient
        colors={[...HERO_GRADIENT]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[styles.card, { borderRadius: radius.cardLarge, padding: inset.lg }]}
      >
        <View style={styles.topRow}>
          <Text style={[styles.sectionLabel, { color: colors.text.onPromoMuted }]}>
            {classItem.discipline.toUpperCase()}
          </Text>
          {isLive ? (
            <View
              style={[
                styles.liveBadge,
                {
                  backgroundColor: colors.accent.default,
                  borderRadius: radius.badge,
                },
              ]}
            >
              <View style={styles.liveDot} />
              <Text style={[styles.liveBadgeText, { color: colors.accent.onAccent }]}>LIVE</Text>
            </View>
          ) : null}
        </View>

        <Text
          style={[
            typography.textPresets.coachSectionTitle,
            styles.classTitle,
            { color: colors.text.onPromo },
          ]}
          numberOfLines={2}
        >
          {classItem.title}
        </Text>

        <Text style={[styles.metaText, { color: colors.text.onPromoMuted }]}>{scheduleLabel}</Text>

        <View
          style={[
            styles.statsRow,
            {
              borderTopColor: colors.border.onPromo,
              marginTop: inset.md,
              paddingTop: inset.md,
            },
          ]}
        >
          <StatCell value={formatDurationShort(classItem.durationMinutes)} label="DURATION" />
          <View style={[styles.statDivider, { backgroundColor: colors.border.onPromo }]} />
          <StatCell
            value={
              <Text style={styles.statValue} numberOfLines={1}>
                <Text style={{ color: colors.text.onPromo }}>{rosterStat.bookedLabel}</Text>
                <Text style={{ color: colors.text.onPromoMuted }}>{rosterStat.capacitySuffix}</Text>
              </Text>
            }
            label="ROSTER"
          />
        </View>
      </LinearGradient>
    </View>
  );
});

const styles = StyleSheet.create({
  cardShell: {
    overflow: 'hidden',
  },
  card: {},
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  liveBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDot: {
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    height: 6,
    marginRight: 6,
    width: 6,
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  classTitle: {
    letterSpacing: -0.5,
    marginTop: 12,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 6,
  },
  statsRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  statCell: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statDivider: {
    height: 28,
    width: StyleSheet.hairlineWidth,
  },
});
