import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';

type BannerVariant = 'early' | 'resume';

type Props = {
  variant: BannerVariant;
  unmarkedCount?: number;
};

export const RollCallLifecycleBanner = memo(function RollCallLifecycleBanner({
  variant,
  unmarkedCount = 0,
}: Props) {
  const { colors, inset, radius, typography, gap } = useTheme();

  const isEarly = variant === 'early';
  const backgroundColor = isEarly ? colors.status.warningSubtle : colors.status.successSubtle;
  const borderColor = isEarly ? colors.status.warningBorder : colors.status.successBorder;
  const textColor = isEarly ? colors.status.warning : colors.status.success;
  const iconName = isEarly ? 'time-outline' : 'refresh-outline';
  const title = isEarly ? 'Early — roster may change' : 'Resuming roll call';
  const message = isEarly
    ? 'Class has not started yet. Bookings may update before you finish.'
    : `${unmarkedCount} member${unmarkedCount === 1 ? '' : 's'} left to mark. Your saved progress continues here.`;

  return (
    <View
      style={[
        styles.banner,
        {
          backgroundColor,
          borderColor,
          borderRadius: radius.card,
          padding: inset.md,
          gap: gap.xs,
        },
      ]}
    >
      <View style={[styles.row, { gap: gap.sm }]}>
        <Ionicons name={iconName} size={18} color={textColor} />
        <Text style={[typography.textPresets.bodyStrong, { color: textColor, flex: 1 }]}>
          {title}
        </Text>
      </View>
      <Text style={[typography.textPresets.footnote, { color: textColor }]}>{message}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  banner: {
    borderWidth: 1,
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
