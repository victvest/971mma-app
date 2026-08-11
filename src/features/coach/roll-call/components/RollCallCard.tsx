import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { initialsFromName } from '@/features/onboarding/services/onboardingValidation';
import type { RollCallDeckMember } from '@/features/coach/roll-call/types';
import { resolveRollCallMemberAvatar } from '@/features/coach/roll-call/utils/rollCallAvatarUrl';
import { useTheme } from '@/shared/theme';
import {
  RollCallStatusChip,
  type RollCallStatusChipVariant,
} from '@/features/coach/roll-call/components/RollCallStatusChip';
import { RollCallMarkStatusChip } from '@/features/coach/roll-call/components/RollCallMarkStatusChip';

type Props = {
  member: RollCallDeckMember;
  showContextChips?: boolean;
  edgeToEdge?: boolean;
  style?: StyleProp<ViewStyle>;
};

function formatBeltLine(beltRank: string | null, beltStripes: number): string | null {
  if (!beltRank?.trim()) return null;
  if (beltStripes <= 0) return beltRank.trim();
  const stripeLabel = beltStripes === 1 ? 'stripe' : 'stripes';
  return `${beltRank.trim()} · ${beltStripes} ${stripeLabel}`;
}

function statusChipsForMember(member: RollCallDeckMember): RollCallStatusChipVariant[] {
  const chips: RollCallStatusChipVariant[] = [];
  if (member.mark?.method === 'qr_scan') chips.push('qr_code');
  if (member.isWalkIn && !member.mark) chips.push('walk_in');
  if (member.hasFacilityCheckInToday) {
    chips.push('at_academy');
    if (member.presentedBy) chips.push('guardian_entry');
  } else if (member.isOnApp) {
    chips.push('no_entry_scan');
  }
  if (member.isBookedOnRoster) chips.push('booked');
  if (!member.isOnApp) chips.push('not_on_app');
  return chips;
}

const RollCallCardChips = memo(function RollCallCardChips({
  chips,
}: {
  chips: RollCallStatusChipVariant[];
}) {
  const { gap } = useTheme();

  if (chips.length === 0) return null;

  return (
    <View style={[styles.chipRow, { gap: gap.xs }]}>
      {chips.map((variant) => (
        <RollCallStatusChip key={variant} variant={variant} />
      ))}
    </View>
  );
});

const RollCallCardPhoto = memo(function RollCallCardPhoto({
  member,
}: {
  member: RollCallDeckMember;
}) {
  const { colors, typography } = useTheme();
  const initials = useMemo(() => initialsFromName(member.displayName), [member.displayName]);
  const avatarUrl = useMemo(() => resolveRollCallMemberAvatar(member), [member]);

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={member.deckKey}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={`${member.displayName} photo`}
      />
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.initialsSurface,
        { backgroundColor: colors.accent.subtle },
      ]}
      accessibilityLabel={`${member.displayName} initials`}
    >
      <Text style={[typography.textPresets.coachDisplayCompact, { color: colors.accent.default }]}>
        {initials}
      </Text>
    </View>
  );
});

export const RollCallCard = memo(function RollCallCard({
  member,
  showContextChips = false,
  edgeToEdge = false,
  style,
}: Props) {
  const { colors, inset, typography, gap, radii: radiiTokens } = useTheme();
  const chips = useMemo(() => {
    const all = statusChipsForMember(member);
    if (showContextChips) return all;
    // Always surface check-in + QR badges even when other context chips are hidden.
    return all.filter(
      (variant) =>
        variant === 'qr_code' || variant === 'at_academy' || variant === 'guardian_entry',
    );
  }, [member, showContextChips]);
  const beltLine = useMemo(
    () => formatBeltLine(member.beltRank, member.beltStripes),
    [member.beltRank, member.beltStripes],
  );

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: edgeToEdge ? radiiTokens.md : radiiTokens.lg,
          backgroundColor: colors.surface.secondary,
        },
        style,
      ]}
      accessibilityRole="summary"
      accessibilityLabel={`${member.displayName}${beltLine ? `, ${beltLine}` : ''}${
        member.hasFacilityCheckInToday ? ', Checked In' : ''
      }`}
    >
      <RollCallCardPhoto member={member} />

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.02)', colors.media.scrimMiddle, colors.media.scrimBottom]}
        locations={[0.18, 0.62, 1]}
        style={styles.bottomScrim}
      />

      {showContextChips || chips.length > 0 || member.mark ? (
        <View style={[styles.chipOverlay, { padding: inset.md }]}>
          <View style={[styles.chipRow, { gap: gap.xs }]}>
            {member.mark ? <RollCallMarkStatusChip mark={member.mark} /> : null}
            <RollCallCardChips chips={chips} />
          </View>
        </View>
      ) : null}

      <View style={[styles.footer, { padding: inset.lg, gap: gap.xs }]}>
        <Text
          style={[typography.textPresets.coachName, styles.name, { color: colors.text.inverse }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {member.displayName}
        </Text>
        {beltLine ? (
          <Text
            style={[typography.textPresets.body, styles.belt, { color: colors.text.inverse }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {beltLine}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
  },
  bottomScrim: {
    ...StyleSheet.absoluteFill,
  },
  chipOverlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  footer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  initialsSurface: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  belt: {
    opacity: 0.92,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
