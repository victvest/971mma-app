import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { CommunityOwnerBadge } from '@/features/communities/components/CommunityOwnerBadge';
import { useTheme } from '@/shared/theme';
import type { CommunityChannelHeader as CommunityChannelHeaderData } from '@/types/domain';

type CommunityChannelHeaderProps = {
  header: CommunityChannelHeaderData;
};

export function CommunityChannelHeader({ header }: CommunityChannelHeaderProps) {
  const { colors, typography, inset, gap, radius } = useTheme();

  return (
    <View style={[styles.root, { gap: gap.md, paddingHorizontal: inset.lg, paddingVertical: inset.md }]}>
      <View style={[styles.topRow, { gap: gap.md }]}>
        <MemberAvatar
          name={header.coachName}
          avatarUrl={header.coachAvatarUrl}
          size={52}
          backgroundColor={colors.accent.default}
          textColor={colors.text.inverse}
        />

        <View style={[styles.copy, { gap: gap.xs }]}>
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]} numberOfLines={2}>
            {header.title}
          </Text>
          <View style={[styles.metaRow, { gap: gap.xs }]}>
            <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]} numberOfLines={1}>
              {header.coachName}
            </Text>
            {header.isCoachOwner ? <CommunityOwnerBadge compact /> : null}
          </View>
          <View style={[styles.statsRow, { gap: gap.sm }]}>
            <View style={styles.stat}>
              <Ionicons name="people-outline" size={13} color={colors.text.tertiary} />
              <Text style={[styles.statText, { color: colors.text.tertiary }]}>
                {header.memberCount} member{header.memberCount === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={[styles.disciplinePill, { backgroundColor: colors.fill.secondary, borderRadius: radius.pill }]}>
              <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
                {header.disciplineName}
              </Text>
            </View>
          </View>
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
  stat: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
  },
  disciplinePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
