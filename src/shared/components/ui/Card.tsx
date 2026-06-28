import React, { useMemo } from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';

export type CardVariant = 'default' | 'elevated' | 'flat' | 'accent';

type Props = {
  children: React.ReactNode;
  variant?: CardVariant;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = 'default', padded = true, style }: Props) {
  const { colors, radius, inset } = useTheme();

  const variantStyle = useMemo(() => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
        };
      case 'flat':
        return {
          backgroundColor: colors.surface.secondary,
          borderColor: colors.border.subtle,
        };
      case 'accent':
        return {
          backgroundColor: colors.accent.subtle,
          borderColor: colors.accent.default,
        };
      default:
        return {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
        };
    }
  }, [variant, colors]);

  return (
    <View
      style={[
        styles.base,
        { borderRadius: radius.card },
        variantStyle,
        padded && { padding: inset.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
