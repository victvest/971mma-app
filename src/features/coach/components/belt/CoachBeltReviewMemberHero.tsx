import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { initialsFromName } from '@/features/onboarding/services/onboardingValidation';
import { resolveRollCallMemberAvatar } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';
import { AnimatedProgressRing } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

type Props = {
  fullName: string;
  avatarUrl: string | null;
  beltRank: string;
  currentStripe: number;
  trainingDays: number;
  recentCheckIns: number;
  percent: number;
};

export const CoachBeltReviewMemberHero = memo(function CoachBeltReviewMemberHero({
  fullName,
  avatarUrl,
  beltRank,
  currentStripe,
  trainingDays,
  recentCheckIns,
  percent,
}: Props) {
  const { colors, typography, inset, gap, radius, surfaceShadow } = useTheme();

  const photoUrl = useMemo(
    () => resolveRollCallMemberAvatar({ avatarUrl, displayName: fullName }),
    [avatarUrl, fullName],
  );
  const initials = useMemo(() => initialsFromName(fullName), [fullName]);

  return (
    <View
      style={[
        styles.card,
        surfaceShadow('card'),
        {
          backgroundColor: colors.surface.primary,
          borderRadius: radius.cardLarge,
          borderColor: colors.border.subtle,
          padding: inset.lg,
          gap: gap.lg,
        },
      ]}
    >
      <View style={[styles.topRow, { gap: gap.md }]}>
        <View
          style={[
            styles.avatarRing,
            {
              borderColor: colors.accent.default,
              borderRadius: radius.pill,
            },
          ]}
        >
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              contentFit="cover"
              cachePolicy="memory-disk"
              style={[
                styles.avatar,
                { borderRadius: radius.pill, backgroundColor: colors.fill.secondary },
              ]}
              accessibilityLabel={`${fullName} photo`}
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
                {
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent.subtle,
                },
              ]}
            >
              <Text style={[typography.textPresets.title, { color: colors.accent.default }]}>
                {initials}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.identity, { gap: gap.xs }]}>
          <Text
            style={[typography.textPresets.title, { color: colors.text.primary }]}
            numberOfLines={2}
          >
            {fullName}
          </Text>
          <Text
            style={[typography.textPresets.body, { color: colors.text.secondary }]}
            numberOfLines={1}
          >
            {beltRank} · Stripe {currentStripe}
          </Text>
        </View>

        <AnimatedProgressRing
          size={56}
          strokeWidth={4}
          percent={percent}
          trackColor={colors.accent.subtle}
          progressColor={colors.accent.default}
          animate={false}
        >
          <Text
            style={[
              typography.textPresets.captionMedium,
              {
                color: colors.text.primary,
                fontWeight: typography.fontWeight.bold,
              },
            ]}
          >
            {percent.toFixed(0)}%
          </Text>
        </AnimatedProgressRing>
      </View>

      <View style={[styles.statsRow, { gap: gap.md }]}>
        <View style={[styles.statCell, { gap: gap.xs }]}>
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
            TRAINING DAYS
          </Text>
          <Text style={[typography.textPresets.metricValue, { color: colors.text.primary }]}>
            {trainingDays}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border.subtle }]} />
        <View style={[styles.statCell, { gap: gap.xs }]}>
          <Text style={[typography.textPresets.metricLabel, { color: colors.text.tertiary }]}>
            CHECK-INS (14D)
          </Text>
          <Text style={[typography.textPresets.metricValue, { color: colors.text.primary }]}>
            {recentCheckIns}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  avatarRing: {
    borderWidth: 2,
    padding: 2,
  },
  avatar: {
    height: 72,
    width: 72,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  statsRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
  },
  statDivider: {
    alignSelf: 'stretch',
    width: StyleSheet.hairlineWidth,
  },
});
