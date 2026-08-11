import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QrPassCard } from '@/features/checkin/components/QrPassCard';
import { useTheme } from '@/shared/theme';

type Props = {
  token: string | null | undefined;
  expiresAt?: string | null;
  memberId?: string | null;
  loading: boolean;
  checkedInToday: boolean;
  checkedInAt?: string | null;
  memberName: string;
  canShowActiveQr: boolean;
  expiryDate?: string | null;
  expiryLoading?: boolean;
  isGuest?: boolean;
  isRegistered?: boolean;
  onRequireAccount?: () => void;
};

function LockedQrCard({ name }: { name: string }) {
  const { colors, typography, radius, inset, gap, layout } = useTheme();

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${name}. Pass must be shown from their own device.`}
      style={[
        styles.lockedCard,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          padding: inset.lg,
          gap: gap.md,
        },
      ]}
    >
      <Ionicons name="phone-portrait-outline" size={34} color={colors.accent.default} />
      <Text
        style={[typography.textPresets.title, { color: colors.text.primary, textAlign: 'center' }]}
        numberOfLines={2}
      >
        {name}
      </Text>
      <Text style={[typography.textPresets.body, { color: colors.text.secondary, textAlign: 'center' }]}>
        This trainee’s gate pass must be shown from their own device.
      </Text>
    </View>
  );
}

export function FamilyQrPager({
  token,
  expiresAt,
  memberId,
  loading,
  checkedInToday,
  checkedInAt,
  memberName,
  canShowActiveQr,
  expiryDate,
  expiryLoading,
  isGuest = false,
  isRegistered = false,
  onRequireAccount,
}: Props) {
  if (!canShowActiveQr) {
    return <LockedQrCard name={memberName} />;
  }

  return (
    <QrPassCard
      token={token}
      expiresAt={expiresAt}
      memberId={memberId}
      loading={loading}
      checkedInToday={checkedInToday}
      checkedInAt={checkedInAt}
      memberName={memberName}
      expiryDate={expiryDate}
      expiryLoading={expiryLoading}
      isGuest={isGuest}
      isRegistered={isRegistered}
      onRequireAccount={onRequireAccount}
    />
  );
}

const styles = StyleSheet.create({
  lockedCard: { minHeight: 420, alignItems: 'center', justifyContent: 'center' },
});
