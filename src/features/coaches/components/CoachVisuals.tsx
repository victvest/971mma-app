import React from 'react';
import { StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { Star } from 'lucide-react-native';
import { GlassMediaChip } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';
import type { CoachItem } from '@/types/domain';
import { academyAssets } from '@/features/academy/assets';
import coachFallbackTeam from '../../../../assets/images/optimized/coach-fallback-team.jpg';
import coachFallbackMma from '../../../../assets/images/optimized/coach-fallback-mma.jpg';
import coachFallbackStriking from '../../../../assets/images/optimized/coach-fallback-striking.jpg';
import rogerioAlvesFilhoPortrait from '../../../../assets/images/coaches/rogerio-alves-filho.jpg';
import wagnerGabrielSilvaPortrait from '../../../../assets/images/coaches/wagner-gabriel-silva.jpg';
import ahmadBoutiPortrait from '../../../../assets/images/coaches/ahmad-bouti.jpg';
import wellingtonPereiraPortrait from '../../../../assets/images/coaches/wellington-pereira.jpg';
import mohammadaliGeraeiPortrait from '../../../../assets/images/coaches/mohammadali-geraei.jpg';
import josephGerrardPortrait from '../../../../assets/images/coaches/joseph-gerrard.jpg';
import carlBoothPortrait from '../../../../assets/images/coaches/carl-booth.jpg';

const FALLBACK_IMAGES = [
  academyAssets.coachFallbackHero,
  coachFallbackTeam,
  coachFallbackMma,
  coachFallbackStriking,
] as const;

/** Local portraits when Mindbody has no ImageUrl (matched by slug fragment or name). */
const LOCAL_COACH_PORTRAITS: Record<string, ImageSourcePropType> = {
  'rogerio-alves-filho': rogerioAlvesFilhoPortrait,
  'rogerio alves filho': rogerioAlvesFilhoPortrait,
  'wagner-gabriel-silva': wagnerGabrielSilvaPortrait,
  'wagner gabriel silva': wagnerGabrielSilvaPortrait,
  'ahmad-bouti': ahmadBoutiPortrait,
  'ahmad bouti': ahmadBoutiPortrait,
  'wellington-pereira': wellingtonPereiraPortrait,
  'wellington pereira': wellingtonPereiraPortrait,
  'mohammadali-geraei': mohammadaliGeraeiPortrait,
  'mohammadali geraei': mohammadaliGeraeiPortrait,
  'joseph-gerrard': josephGerrardPortrait,
  'joseph gerrard': josephGerrardPortrait,
  'joe gerrard': josephGerrardPortrait,
  'carl-booth': carlBoothPortrait,
  'carl booth': carlBoothPortrait,
};

function localCoachPortrait(coach: Pick<CoachItem, 'name' | 'mindbodyStaffId'>): ImageSourcePropType | null {
  const nameKey = coach.name.trim().toLowerCase();
  if (LOCAL_COACH_PORTRAITS[nameKey]) return LOCAL_COACH_PORTRAITS[nameKey];

  // Slugs look like "rogerio-alves-filho-000069" — match the stable name prefix.
  for (const [key, source] of Object.entries(LOCAL_COACH_PORTRAITS)) {
    if (key.includes(' ') ) continue;
    if (nameKey.includes(key.replace(/-/g, ' '))) return source;
  }
  return null;
}

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
  // Prefer bundled academy portraits so Mindbody null/wipes never show gym fallbacks.
  if (coach) {
    const local = localCoachPortrait(coach);
    if (local) return local;
  }
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
      <Text
        style={[typography.textPresets.label, { color: colors.text.inverse, letterSpacing: 0.3 }]}
      >
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
        <Text
          style={[
            typography.textPresets.label,
            { color: colors.accent.onAccent, letterSpacing: 0.5 },
          ]}
        >
          {label}
        </Text>
      </View>
    );
  }

  return (
    <GlassMediaChip>
      <Text
        style={[typography.textPresets.label, { color: colors.text.inverse, letterSpacing: 0.5 }]}
      >
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
