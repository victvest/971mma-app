import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import type { RollCallMemberPreview } from '@/features/coach/roll-call/types';
import { resolveRollCallAvatarUrl } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';
import { initialsFromName } from '@/features/onboarding/services/onboardingValidation';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
import { useTheme } from '@/shared/theme';

type Props = {
  visible: boolean;
  member: RollCallMemberPreview | null;
  isConfirming?: boolean;
  onDismiss: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
};

const MembershipBadge = memo(function MembershipBadge({
  active,
  statusLabel,
}: {
  active: boolean;
  statusLabel: string;
}) {
  const { colors, radius, typography, inset } = useTheme();
  const label = statusLabel.trim() || (active ? 'Active' : 'Inactive');
  const accentColor = active ? colors.accent.default : colors.text.tertiary;

  return (
    <View
      style={[
        styles.badge,
        {
          borderRadius: radius.pill,
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          paddingHorizontal: inset.md,
        },
      ]}
      accessibilityRole="text"
      accessibilityLabel={`Membership ${label}`}
    >
      <View style={[styles.badgeDot, { backgroundColor: accentColor }]} />
      <Text style={[typography.textPresets.bodyStrong, styles.badgeLabel, { color: colors.text.primary }]}>
        {label}
      </Text>
    </View>
  );
});

export const RollCallScanConfirmSheet = memo(function RollCallScanConfirmSheet({
  visible,
  member,
  isConfirming = false,
  onDismiss,
  onConfirm,
  confirmLabel,
}: Props) {
  const { colors, typography, inset, gap, radius } = useTheme();

  const initials = useMemo(
    () => (member ? initialsFromName(member.fullName) : ''),
    [member],
  );
  const avatarUrl = useMemo(
    () => (member ? resolveRollCallAvatarUrl(member.avatarUrl) : null),
    [member],
  );

  if (!member) return null;

  return (
    <AppBottomSheet visible={visible} onDismiss={onDismiss} dismissOnBackdropPress={!isConfirming}>
      <View style={[styles.content, { gap: gap.lg }]}>
        <Text style={[typography.textPresets.subtitle, { color: colors.text.primary, textAlign: 'center' }]}>
          Confirm member
        </Text>

        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            contentFit="cover"
            cachePolicy="memory-disk"
            style={[
              styles.photo,
              {
                borderRadius: radius.pill,
                backgroundColor: colors.fill.secondary,
              },
            ]}
            accessibilityLabel={`${member.fullName} photo`}
          />
        ) : (
          <View
            style={[
              styles.photo,
              styles.photoFallback,
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

        <View style={[styles.meta, { gap: gap.sm }]}>
          <Text
            style={[typography.textPresets.title, styles.name, { color: colors.text.primary }]}
            numberOfLines={2}
          >
            {member.fullName}
          </Text>
          <MembershipBadge
            active={member.membershipActive}
            statusLabel={member.membershipActive ? 'Active' : 'Inactive'}
          />
        </View>

        <View style={[styles.actions, { gap: gap.sm, paddingTop: inset.sm }]}>
          <AppBottomSheetButton
            label={isConfirming ? 'Adding…' : (confirmLabel ?? 'Confirm present')}
            onPress={isConfirming ? () => undefined : onConfirm}
          />
          <AppBottomSheetButton
            label="Cancel"
            variant="secondary"
            onPress={isConfirming ? () => undefined : onDismiss}
          />
        </View>
      </View>
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
  },
  photo: {
    height: 160,
    width: 160,
  },
  photoFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    alignItems: 'center',
    width: '100%',
  },
  name: {
    textAlign: 'center',
  },
  badge: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 8,
    minHeight: 36,
  },
  badgeDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  badgeLabel: {
    fontWeight: '600',
  },
  actions: {
    alignSelf: 'stretch',
    width: '100%',
  },
});
