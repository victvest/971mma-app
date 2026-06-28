import React, { memo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BadgeCheck, Dumbbell, Flame } from 'lucide-react-native';
import { SkeletonRect } from '@/shared/animations/SkeletonLoader';
import { HomeElevatedCard } from '@/features/home/components/HomeElevatedCard';
import { useTheme, radii } from '@/shared/theme';
import type { DisciplineScoreSummary, MembershipSummary } from '@/types/domain';

type Props = {
  score: DisciplineScoreSummary | undefined;
  membership: MembershipSummary | undefined;
  scoreLoading: boolean;
  membershipLoading: boolean;
  hideMembership?: boolean;
};

function membershipHeadline(membership: MembershipSummary | undefined): string {
  if (!membership) return '—';
  if (membership.status === 'active') return 'Active';
  if (membership.status === 'paused') return 'Paused';
  if (membership.status === 'expired') return 'Expired';
  if (membership.status === 'none') return 'None';
  return 'Inactive';
}

function membershipFootnote(membership: MembershipSummary | undefined): string {
  if (!membership?.planName) {
    return membership?.status === 'active' ? 'Membership active' : 'No active plan';
  }
  return membership.planName;
}

function membershipValueColor(
  membership: MembershipSummary | undefined,
  colors: {
    accent: { default: string };
    status: { warning: string; error: string };
    text: { primary: string };
  },
): string {
  if (!membership) return colors.text.primary;
  if (membership.status === 'active') return colors.accent.default;
  if (membership.status === 'paused') return colors.status.warning;
  if (membership.status === 'expired') return colors.status.error;
  return colors.text.primary;
}

type StatCardProps = {
  label: string;
  accentColor: string;
  iconBg: string;
  icon: ReactNode;
  loading: boolean;
  value: ReactNode;
  footnote?: string;
};

function StatCard({
  label,
  accentColor,
  iconBg,
  icon,
  loading,
  value,
  footnote,
}: StatCardProps) {
  const { colors, typography, radius, inset } = useTheme();

  return (
    <HomeElevatedCard padded={false} style={styles.card} contentStyle={[styles.cardInner, { padding: inset.md }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.92)', 'rgba(255,255,255,0)']}
        style={[
          styles.topSheen,
          { borderTopLeftRadius: radius.cardLarge, borderTopRightRadius: radius.cardLarge },
        ]}
        pointerEvents="none"
      />

      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <View style={[styles.labelDot, { backgroundColor: accentColor }]} />
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.primary }]}>
            {label}
          </Text>
        </View>
        <View style={[styles.iconWell, { backgroundColor: iconBg }]}>{icon}</View>
      </View>

      <View style={styles.valueSlot}>
        {loading ? <SkeletonRect width="52%" height={34} borderRadius={radii.sm} /> : value}
      </View>

      {footnote && !loading ? (
        <Text
          style={[typography.textPresets.caption, styles.footnote, { color: colors.text.tertiary }]}
          numberOfLines={1}
        >
          {footnote}
        </Text>
      ) : null}
    </HomeElevatedCard>
  );
}

export const CheckInStatCards = memo(function CheckInStatCards({
  score,
  membership,
  scoreLoading,
  membershipLoading,
  hideMembership = false,
}: Props) {
  const { colors, typography, gap } = useTheme();
  const membershipTitle = membershipHeadline(membership);
  const streak = score?.currentStreak ?? 0;
  const streakFootnote =
    score?.streakStatus === 'grace'
      ? 'Grace window active'
      : streak > 0
        ? `${streak === 1 ? '1 day' : `${streak} days`} protected`
        : 'Train to start a streak';

  return (
    <View style={[styles.row, { gap: gap.md }]}>
      <StatCard
        label="Streak"
        accentColor={colors.accent.default}
        iconBg={colors.accent.subtle}
        icon={<Flame size={16} color={colors.accent.default} strokeWidth={2.25} />}
        loading={scoreLoading}
        footnote={streakFootnote}
        value={
          <View style={styles.metricBlock}>
            <Text style={[typography.textPresets.metricValue, { color: colors.text.primary }]}>
              {streak}
            </Text>
            <Text style={[typography.textPresets.callout, { color: colors.text.secondary }]}>
              days
            </Text>
          </View>
        }
      />

      {hideMembership ? (
        <StatCard
          label="Training"
          accentColor={colors.status.success}
          iconBg={colors.status.successSubtle}
          icon={<Dumbbell size={16} color={colors.status.success} strokeWidth={2.25} />}
          loading={scoreLoading}
          footnote="Classes completed"
          value={
            <Text style={[typography.textPresets.metricValue, { color: colors.text.primary }]}>
              {score?.trainingDays ?? 0}
            </Text>
          }
        />
      ) : (
        <StatCard
          label="Membership"
          accentColor={
            membership?.status === 'active'
              ? colors.accent.default
              : membership?.status === 'expired'
                ? colors.status.error
                : colors.text.tertiary
          }
          iconBg={
            membership?.status === 'active' ? colors.accent.subtle : colors.surface.secondary
          }
          icon={
            <BadgeCheck
              size={16}
              color={
                membership?.status === 'active' ? colors.accent.default : colors.text.secondary
              }
              strokeWidth={2.25}
            />
          }
          loading={membershipLoading}
          footnote={membershipFootnote(membership)}
          value={
            <Text
              style={[
                typography.textPresets.metricValue,
                styles.membershipValue,
                { color: membershipValueColor(membership, colors) },
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {membershipTitle}
            </Text>
          }
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  card: {
    flex: 1,
    minHeight: 132,
  },
  cardInner: {
    flex: 1,
    gap: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  topSheen: {
    height: 40,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  labelDot: {
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  iconWell: {
    alignItems: 'center',
    borderRadius: 999,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  valueSlot: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  metricBlock: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: 6,
  },
  membershipValue: {
    letterSpacing: -0.3,
    width: '100%',
  },
  footnote: {
    marginTop: -2,
  },
});
