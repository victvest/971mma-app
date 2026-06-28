import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Gift, QrCode } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { useTheme } from '@/shared/theme';

type ActionRowProps = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
  showDivider?: boolean;
};

const ActionRow = memo(function ActionRow({
  icon: Icon,
  title,
  subtitle,
  iconColor,
  iconBg,
  onPress,
  showDivider = false,
}: ActionRowProps) {
  const { colors, typography, inset } = useTheme();

  return (
    <>
      <HomeAnimatedPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={styles.rowPressable}
      >
        <View style={[styles.row, { paddingVertical: inset.sm + 2 }]}>
          <View
            style={[
              styles.iconRing,
              {
                backgroundColor: iconBg,
                borderColor: iconColor,
              },
            ]}
          >
            <Icon size={20} color={iconColor} strokeWidth={2} />
          </View>

          <View style={styles.copy}>
            <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>
              {title}
            </Text>
            <Text
              style={[typography.textPresets.footnote, { color: colors.text.secondary }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          </View>

          <ChevronRight size={18} color={colors.text.tertiary} strokeWidth={2.25} />
        </View>
      </HomeAnimatedPressable>
      {showDivider ? (
        <View
          style={[
            styles.divider,
            {
              backgroundColor: colors.border.subtle,
              marginLeft: inset.md + 44 + inset.sm,
            },
          ]}
        />
      ) : null}
    </>
  );
});

type Props = {
  pointsBalance: number;
  onOpenCheckIn: () => void;
  onOpenRewards: () => void;
};

export const HomeQuickActions = memo(function HomeQuickActions({
  pointsBalance,
  onOpenCheckIn,
  onOpenRewards,
}: Props) {
  const { colors, radius, inset, shadows, layout } = useTheme();
  const pointsLabel = `${pointsBalance.toLocaleString('en-US')} pts`;

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          paddingHorizontal: inset.md,
        },
      ]}
    >
      <ActionRow
        icon={QrCode}
        title="QR pass"
        subtitle="Tap to open your check-in code"
        iconColor={colors.status.success}
        iconBg={colors.status.successSubtle}
        onPress={onOpenCheckIn}
        showDivider
      />
      <ActionRow
        icon={Gift}
        title={pointsLabel}
        subtitle="Rewards"
        iconColor={colors.accent.default}
        iconBg={colors.accent.subtle}
        onPress={onOpenRewards}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  rowPressable: {
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  iconRing: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
