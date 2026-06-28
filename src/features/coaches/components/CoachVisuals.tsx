import React from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Star } from 'lucide-react-native';
import { GlassMediaChip } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';
import type { CoachItem } from '@/types/domain';
import coachFallbackHero from '../../../../assets/images/optimized/coach-fallback-hero.jpg';
import coachFallbackTeam from '../../../../assets/images/optimized/coach-fallback-team.jpg';
import coachFallbackMma from '../../../../assets/images/optimized/coach-fallback-mma.jpg';
import coachFallbackStriking from '../../../../assets/images/optimized/coach-fallback-striking.jpg';

const FALLBACK_IMAGES = [
  coachFallbackHero,
  coachFallbackTeam,
  coachFallbackMma,
  coachFallbackStriking,
] as const;

export function getCoachInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function getCoachImageSource(
  coach: CoachItem | null | undefined,
  fallbackIndex = 0,
): ImageSourcePropType {
  if (coach?.photoUrl) return { uri: coach.photoUrl };
  return FALLBACK_IMAGES[fallbackIndex % FALLBACK_IMAGES.length];
}

export function getCoachRatingLabel(coach: Pick<CoachItem, 'rating'>): string {
  return coach.rating === null || coach.rating === undefined ? '--' : coach.rating.toFixed(1);
}

export function getCoachSpecialtyLabel(coach: Pick<CoachItem, 'specialty'>): string {
  return coach.specialty?.trim() || 'MMA';
}

export function getCoachRoleLabel(coach: Pick<CoachItem, 'isHeadCoach'>): string {
  return coach.isHeadCoach ? 'HEAD COACH' : 'COACH';
}

export function getCoachRankLabel(coach: Pick<CoachItem, 'rank'>): string {
  return coach.rank?.trim() || 'Rank pending';
}

export function getCoachPrimaryRank(coach: Pick<CoachItem, 'rank' | 'specialty'>): string {
  const rank = coach.rank?.trim();
  if (rank) return rank.split(/\s+/)[0] ?? rank;
  return getCoachSpecialtyLabel(coach);
}

export function getCoachDisciplineTags(coach: Pick<CoachItem, 'specialty' | 'rank'>): string[] {
  const source = `${coach.specialty ?? ''} ${coach.rank ?? ''}`.toUpperCase();
  const tags: string[] = [];

  if (source.includes('BJJ') || source.includes('JIU') || source.includes('BLACK')) {
    tags.push('BJJ GI', 'BJJ NOGI');
  }
  if (source.includes('MUAY')) tags.push('MUAY THAI');
  if (source.includes('BOX')) tags.push('BOXING');
  if (source.includes('MMA') || tags.length === 0) tags.push('MMA');
  if (source.includes('CONDITION')) tags.push('CONDITIONING');

  return Array.from(new Set(tags)).slice(0, 3);
}

type CoachAvatarBadgeProps = {
  name: string;
  size: 'large' | 'small';
};

export function CoachAvatarBadge({ name, size }: CoachAvatarBadgeProps) {
  const { colors, typography, layout, radius } = useTheme();
  const avatarSize = size === 'large' ? layout.coachAvatarLarge : layout.coachAvatarSmall;
  const textPreset =
    size === 'large' ? typography.textPresets.metricValue : typography.textPresets.subtitle;

  return (
    <View
      style={[
        styles.avatar,
        {
          width: avatarSize,
          height: avatarSize,
          borderRadius: radius.pill,
          borderWidth: layout.coachAvatarBorder,
          borderColor: colors.surface.primary,
          backgroundColor: colors.accent.default,
        },
      ]}
    >
      <Text style={[textPreset, { color: colors.accent.onAccent }]}>{getCoachInitials(name)}</Text>
    </View>
  );
}

type RatingPillProps = {
  rating: string;
};

export function RatingPill({ rating }: RatingPillProps) {
  const { colors, typography } = useTheme();

  return (
    <GlassMediaChip>
      <Star size={12} color={colors.text.inverse} fill={colors.text.inverse} strokeWidth={0} />
      <Text style={[typography.textPresets.label, { color: colors.text.inverse, letterSpacing: 0.3 }]}>
        {rating}
      </Text>
    </GlassMediaChip>
  );
}

type CoachRoleChipProps = {
  label: string;
  headCoach?: boolean;
};

export function CoachRoleChip({ label, headCoach = false }: CoachRoleChipProps) {
  const { colors, typography, inset, radius } = useTheme();

  if (headCoach) {
    return (
      <View
        style={[
          styles.roleChipSolid,
          {
            backgroundColor: colors.accent.default,
            borderRadius: radius.pill,
            paddingHorizontal: inset.sm,
            paddingVertical: inset.xs,
          },
        ]}
      >
        <Text style={[typography.textPresets.label, { color: colors.accent.onAccent, letterSpacing: 0.5 }]}>
          {label}
        </Text>
      </View>
    );
  }

  return (
    <GlassMediaChip>
      <Text style={[typography.textPresets.label, { color: colors.text.inverse, letterSpacing: 0.5 }]}>
        {label}
      </Text>
    </GlassMediaChip>
  );
}

type DisciplinePillProps = {
  label: string;
  elevated?: boolean;
};

export function DisciplinePill({ label, elevated = false }: DisciplinePillProps) {
  const { colors, typography, inset, radius, layout } = useTheme();

  return (
    <View
      style={[
        styles.disciplinePill,
        {
          paddingHorizontal: inset.sm,
          paddingVertical: inset.xs,
          borderRadius: radius.pill,
          borderWidth: elevated ? layout.borderWidth : layout.borderWidthStrong,
          borderColor: elevated ? colors.accent.subtle : colors.text.tertiary,
          backgroundColor: elevated ? colors.accent.subtle : colors.text.tertiary,
        },
      ]}
    >
      <Text
        style={[
          typography.textPresets.buttonSmall,
          { color: elevated ? colors.accent.pressed : colors.text.inverse },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleChipSolid: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disciplinePill: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
