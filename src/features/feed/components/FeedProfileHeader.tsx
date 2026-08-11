import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import type { FeedProfile } from '@/features/feed/types';
import {
  formatCompactCount,
  formatFeedBeltLine,
  formatFeedMemberSince,
} from '@/features/feed/utils/feedFormat';
import { MemberAvatarWithCoachBadge } from './MemberAvatarWithCoachBadge';

type Props = {
  profile: FeedProfile;
};

type MetaChipProps = {
  label: string;
  accent?: boolean;
};

function MetaChip({ label, accent = false }: MetaChipProps) {
  const { colors, typography, inset, radius } = useTheme();

  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: accent ? colors.accent.subtle : colors.background.secondary,
          borderRadius: radius.badge,
          paddingHorizontal: inset.sm,
          paddingVertical: inset.xs,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[
          typography.textPresets.captionMedium,
          { color: accent ? colors.accent.default : colors.text.secondary },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={[styles.stat, { gap: gap.xs }]}>
      <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>{value}</Text>
      <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>{label}</Text>
    </View>
  );
}

export const FeedProfileHeader = memo(function FeedProfileHeader({ profile }: Props) {
  const { colors, typography, inset, gap, radius, layout, surfaceShadow } = useTheme();

  const roleLabel = profile.role === 'coach' ? 'Coach' : 'Member';
  const beltLine = useMemo(
    () => formatFeedBeltLine(profile.beltRank, profile.beltStripes),
    [profile.beltRank, profile.beltStripes],
  );
  const memberSince = useMemo(
    () => formatFeedMemberSince(profile.memberSince),
    [profile.memberSince],
  );

  const subtitleParts = useMemo(() => {
    const parts: string[] = [];
    if (profile.primaryDiscipline) parts.push(profile.primaryDiscipline);
    if (memberSince) parts.push(`Since ${memberSince}`);
    return parts;
  }, [memberSince, profile.primaryDiscipline]);

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
          paddingHorizontal: inset.lg,
          paddingTop: inset.xl,
          paddingBottom: inset.lg,
          gap: gap.lg,
        },
      ]}
    >
      <View style={[styles.identity, { gap: gap.md }]}>
        <MemberAvatarWithCoachBadge
          name={profile.name}
          avatarUrl={profile.avatarUrl}
          size={80}
          showCoachBadge={profile.isVerifiedCoach}
          backgroundColor={colors.accent.subtle}
          textColor={colors.accent.default}
        />

        <View style={[styles.nameBlock, { gap: gap.xs }]}>
          <View style={[styles.nameRow, { gap: gap.xs }]}>
            <Text
              numberOfLines={2}
              style={[
                typography.textPresets.title,
                styles.name,
                { color: colors.text.primary, textAlign: 'center' },
              ]}
            >
              {profile.name}
            </Text>
          </View>

          {subtitleParts.length > 0 ? (
            <Text
              numberOfLines={1}
              style={[
                typography.textPresets.caption,
                { color: colors.text.tertiary, textAlign: 'center' },
              ]}
            >
              {subtitleParts.join(' · ')}
            </Text>
          ) : null}
        </View>

        <View style={[styles.chipRow, { gap: gap.xs }]}>
          <MetaChip label={roleLabel} accent={profile.role === 'coach'} />
          {beltLine ? <MetaChip label={beltLine} /> : null}
        </View>
      </View>

      {profile.bio ? (
        <Text
          style={[
            typography.textPresets.body,
            styles.bio,
            { color: colors.text.secondary, textAlign: 'center' },
          ]}
        >
          {profile.bio}
        </Text>
      ) : null}

      <View
        style={[
          styles.statsRow,
          {
            borderTopColor: colors.border.subtle,
            paddingTop: inset.md,
            gap: gap.md,
          },
        ]}
      >
        <StatCell value={formatCompactCount(profile.postCount)} label="Posts" />
        <View style={[styles.statDivider, { backgroundColor: colors.border.subtle }]} />
        <StatCell value={formatCompactCount(profile.followerCount)} label="Followers" />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    alignItems: 'stretch',
  },
  identity: {
    alignItems: 'center',
  },
  nameBlock: {
    alignItems: 'center',
    width: '100%',
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  name: {
    flexShrink: 1,
    minWidth: 0,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  chip: {
    maxWidth: '100%',
  },
  bio: {
    lineHeight: 22,
  },
  statsRow: {
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    alignSelf: 'stretch',
    width: StyleSheet.hairlineWidth,
  },
});
