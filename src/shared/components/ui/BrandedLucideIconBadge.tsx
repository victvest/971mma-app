import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/shared/theme';

export type BrandedIconTone = 'accent' | 'neutral' | 'danger' | 'warning';

type Props = {
  icon: LucideIcon;
  tone?: BrandedIconTone;
  size?: number;
};

export function BrandedLucideIconBadge({
  icon: Icon,
  tone = 'neutral',
  size = 44,
}: Props) {
  const { colors } = useTheme();
  const iconSize = Math.round(size * 0.45);

  const toneStyle =
    tone === 'accent'
      ? {
          backgroundColor: colors.accent.subtle,
          borderColor: `${colors.accent.default}22`,
          iconColor: colors.accent.default,
        }
      : tone === 'danger'
        ? {
            backgroundColor: colors.status.errorSubtle,
            borderColor: `${colors.status.error}22`,
            iconColor: colors.status.error,
          }
        : tone === 'warning'
          ? {
              backgroundColor: colors.status.warningSubtle,
              borderColor: `${colors.status.warning}22`,
              iconColor: colors.status.warning,
            }
          : {
              backgroundColor: colors.surface.secondary,
              borderColor: 'rgba(0, 0, 0, 0.06)',
              iconColor: colors.text.primary,
            };

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
        },
      ]}
    >
      <Icon size={iconSize} color={toneStyle.iconColor} strokeWidth={2.2} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
  },
});
