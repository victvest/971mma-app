import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import { resolveRollCallMemberAvatar } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';
import { initialsFromName } from '@/features/onboarding/services/onboardingValidation';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  member: RollCallDeckMember;
  disabled?: boolean;
  onMarkPresent: (member: RollCallDeckMember) => void;
  onMarkAbsent: (member: RollCallDeckMember) => void;
  onDelete: (member: RollCallDeckMember) => void;
};

type MarkSide = 'present' | 'absent' | null;

function resolveMarkSide(member: RollCallDeckMember): MarkSide {
  const status = member.mark?.status;
  if (!status) return null;
  if (status === 'present' || status === 'late') return 'present';
  if (status === 'absent') return 'absent';
  return null;
}

const RollCallMemberAvatar = memo(function RollCallMemberAvatar({
  member,
}: {
  member: RollCallDeckMember;
}) {
  const { colors, radius, typography } = useTheme();
  const initials = useMemo(() => initialsFromName(member.displayName), [member.displayName]);
  const avatarUrl = useMemo(() => resolveRollCallMemberAvatar(member), [member]);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={member.deckKey}
        style={[
          styles.avatar,
          {
            borderRadius: radius.pill,
            backgroundColor: colors.fill.secondary,
          },
        ]}
        accessibilityLabel={`${member.displayName} photo`}
      />
    );
  }

  return (
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
      <Text style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}>
        {initials}
      </Text>
    </View>
  );
});

const MembershipBadge = memo(function MembershipBadge({
  active,
  statusLabel,
}: {
  active: boolean;
  statusLabel?: string;
}) {
  const { colors, radius, typography, inset } = useTheme();
  const label = statusLabel?.trim() || (active ? 'Active' : 'Inactive');
  const accentColor = active ? colors.accent.default : colors.text.tertiary;

  return (
    <View
      style={[
        styles.badge,
        {
          borderRadius: radius.pill,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          paddingHorizontal: inset.sm,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Membership ${label}`}
    >
      <View style={[styles.badgeDot, { backgroundColor: accentColor }]} />
      <Text style={[typography.textPresets.captionMedium, styles.badgeLabel, { color: colors.text.primary }]}>
        {label}
      </Text>
    </View>
  );
});

export const RollCallMemberRow = memo(function RollCallMemberRow({
  member,
  disabled = false,
  onMarkPresent,
  onMarkAbsent,
  onDelete,
}: Props) {
  const { colors, typography, inset, gap, radius } = useTheme();
  const markSide = useMemo(() => resolveMarkSide(member), [member]);
  const membershipActive = member.membershipActive === true;
  const membershipLabel = membershipActive
    ? 'Active'
    : (member.membershipStatus?.trim() && member.membershipStatus !== 'unknown'
        ? member.membershipStatus
        : 'Inactive');

  const handlePresent = useCallback(() => {
    if (disabled) return;
    triggerLightImpact();
    onMarkPresent(member);
  }, [disabled, member, onMarkPresent]);

  const handleAbsent = useCallback(() => {
    if (disabled) return;
    triggerLightImpact();
    onMarkAbsent(member);
  }, [disabled, member, onMarkAbsent]);

  const handleDelete = useCallback(() => {
    if (disabled) return;
    triggerLightImpact();
    onDelete(member);
  }, [disabled, member, onDelete]);

  return (
    <View
      style={[
        styles.row,
        {
          borderRadius: radius.card,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          padding: inset.md,
          gap: gap.sm,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
      accessibilityRole="none"
    >
      <View style={styles.topRow}>
        <RollCallMemberAvatar member={member} />

        <View style={styles.main}>
          <Text
            style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}
            numberOfLines={1}
          >
            {member.displayName}
          </Text>
          <MembershipBadge active={membershipActive} statusLabel={membershipLabel} />
        </View>

        <Pressable
          onPress={handleDelete}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${member.displayName} from list`}
          hitSlop={8}
          style={({ pressed }) => [
            styles.deleteButton,
            {
              borderRadius: radius.pill,
              backgroundColor: pressed ? colors.fill.secondary : colors.surface.primary,
              borderColor: colors.border.default,
            },
          ]}
        >
          <Ionicons name="trash-outline" size={20} color={colors.status.error} />
        </Pressable>
      </View>

      <View style={[styles.markControls, { gap: gap.xs }]}>
        <MotiPressable
          onPress={handlePresent}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${member.displayName} present`}
          accessibilityState={{ selected: markSide === 'present', disabled }}
          style={[
            styles.markButton,
            {
              minHeight: 44,
              borderRadius: radius.pill,
              borderColor: markSide === 'present' ? colors.accent.default : colors.border.default,
              backgroundColor:
                markSide === 'present' ? colors.accent.subtle : colors.surface.primary,
            },
          ]}
        >
          <Text
            style={[
              typography.textPresets.button,
              {
                color: markSide === 'present' ? colors.accent.default : colors.text.secondary,
              },
            ]}
          >
            Present
          </Text>
        </MotiPressable>

        <MotiPressable
          onPress={handleAbsent}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Mark ${member.displayName} absent`}
          accessibilityState={{ selected: markSide === 'absent', disabled }}
          style={[
            styles.markButton,
            {
              minHeight: 44,
              borderRadius: radius.pill,
              borderColor: markSide === 'absent' ? colors.status.error : colors.border.default,
              backgroundColor:
                markSide === 'absent' ? colors.status.errorSubtle : colors.surface.primary,
            },
          ]}
        >
          <Text
            style={[
              typography.textPresets.button,
              {
                color: markSide === 'absent' ? colors.status.error : colors.text.secondary,
              },
            ]}
          >
            Absent
          </Text>
        </MotiPressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    height: 44,
    width: 44,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 6,
    minHeight: 28,
  },
  badgeDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  badgeLabel: {
    fontWeight: '600',
  },
  deleteButton: {
    alignItems: 'center',
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  markControls: {
    flexDirection: 'row',
  },
  markButton: {
    alignItems: 'center',
    borderWidth: 1.5,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
