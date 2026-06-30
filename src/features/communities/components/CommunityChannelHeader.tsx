import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { CommunityOwnerBadge } from '@/features/communities/components/CommunityOwnerBadge';
import { useTheme } from '@/shared/theme';
import type { CommunityChannelHeader as CommunityChannelHeaderData } from '@/types/domain';

type CommunityChannelHeaderProps = {
  header: CommunityChannelHeaderData;
  role?: 'coach' | 'member' | 'guardian';
};

export function CommunityChannelHeader({ header, role = 'member' }: CommunityChannelHeaderProps) {
  const { colors, typography, inset, gap, radius, layout, shadows } = useTheme();
  const title = header.title.replace(` • ${header.disciplineName}`, '').trim();
  const helper =
    role === 'guardian'
      ? `Read-only updates from ${header.coachName}`
      : `Led by ${header.coachName}`;

  return (
    <View
      style={[
        styles.root,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          gap: gap.sm,
          marginHorizontal: inset.lg,
          paddingHorizontal: inset.md,
          paddingVertical: inset.md,
        },
      ]}
    >
      <View style={[styles.topRow, { gap: gap.md }]}>
        <MemberAvatar
          name={header.coachName}
          avatarUrl={header.coachAvatarUrl}
          size={52}
          backgroundColor={colors.accent.default}
          textColor={colors.text.inverse}
        />

        <View style={[styles.copy, { gap: gap.xs }]}>
          <Text
            style={[typography.textPresets.title, { color: colors.text.primary }]}
            numberOfLines={2}
          >
            {title || header.coachName}
          </Text>
          <View style={[styles.metaRow, { gap: gap.xs }]}>
            <Text
              style={[typography.textPresets.footnote, { color: colors.text.secondary }]}
              numberOfLines={1}
            >
              {helper}
            </Text>
            {header.isCoachOwner ? <CommunityOwnerBadge compact /> : null}
          </View>
        </View>
      </View>

      {header.description ? (
        <Text
          style={[typography.textPresets.footnote, { color: colors.text.secondary }]}
          numberOfLines={3}
        >
          {header.description}
        </Text>
      ) : null}

      <View style={[styles.statsRow, { gap: gap.sm }]}>
        <View
          style={[
            styles.infoPill,
            { backgroundColor: colors.fill.secondary, borderRadius: radius.pill },
          ]}
        >
          <Ionicons name="people-outline" size={13} color={colors.text.tertiary} />
          <Text style={[styles.statText, { color: colors.text.secondary }]}>
            {header.memberCount} member{header.memberCount === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoPill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
