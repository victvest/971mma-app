import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { QrPassCard } from '@/features/checkin/components/QrPassCard';
import { useTheme } from '@/shared/theme';

type Props = {
  token: string | null | undefined;
  loading: boolean;
  checkedInToday: boolean;
  memberName: string;
  beltLine: string;
  canShowActiveQr: boolean;
  planName?: string | null;
  expiryDate?: string | null;
  showSimulate?: boolean;
  simulating?: boolean;
  simulateDisabled?: boolean;
  onSimulate?: () => void;
};

function LockedQrCard({ name }: { name: string }) {
  const { colors, typography, radius, inset, gap, layout } = useTheme();

  return (
    <View
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
      <Text style={[typography.textPresets.title, { color: colors.text.primary }]} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

export function FamilyQrPager({
  token,
  loading,
  checkedInToday,
  memberName,
  beltLine,
  canShowActiveQr,
  planName,
  expiryDate,
  showSimulate,
  simulating,
  simulateDisabled,
  onSimulate,
}: Props) {
  if (!canShowActiveQr) {
    return <LockedQrCard name={memberName} />;
  }

  return (
    <QrPassCard
      token={token}
      loading={loading}
      checkedInToday={checkedInToday}
      memberName={memberName}
      beltLine={beltLine}
      planName={planName}
      expiryDate={expiryDate}
      showSimulate={showSimulate}
      simulating={simulating}
      simulateDisabled={simulateDisabled}
      onSimulate={onSimulate}
    />
  );
}

const styles = StyleSheet.create({
  lockedCard: { minHeight: 420, alignItems: 'center', justifyContent: 'center' },
});
