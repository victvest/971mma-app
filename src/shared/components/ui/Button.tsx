import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { useTheme, type AppColors } from '@/shared/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  full?: boolean;
};

type VariantStyle = { bg: string; fg: string; border: string };

function buildVariants(colors: AppColors): Record<ButtonVariant, VariantStyle> {
  return {
    primary: {
      bg: colors.accent.default,
      fg: colors.accent.onAccent,
      border: colors.accent.default,
    },
    secondary: {
      bg: colors.fill.secondary,
      fg: colors.text.primary,
      border: colors.fill.secondary,
    },
    outline: {
      bg: 'transparent',
      fg: colors.text.primary,
      border: colors.border.default,
    },
    ghost: {
      bg: 'transparent',
      fg: colors.accent.default,
      border: 'transparent',
    },
    danger: {
      bg: colors.status.error,
      fg: colors.text.inverse,
      border: colors.status.error,
    },
  };
}

const sizeMap: Record<ButtonSize, { height: number; px: number; fontSize: number }> = {
  sm: { height: 38, px: 16, fontSize: 13 },
  md: { height: 52, px: 20, fontSize: 15 },
  lg: { height: 58, px: 24, fontSize: 17 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading,
  disabled,
  icon,
  iconPosition = 'left',
  style,
  full = true,
}: Props) {
  const { colors, radius } = useTheme();

  const variants = useMemo(() => buildVariants(colors), [colors]);
  const v = variants[variant];
  const s = sizeMap[size];
  const isDisabled = disabled || loading;
  const isInactiveFilled = (variant === 'primary' || variant === 'danger') && isDisabled;
  const resolved = isInactiveFilled
    ? {
        bg: colors.fill.secondary,
        fg: colors.text.tertiary,
        border: colors.fill.secondary,
      }
    : v;

  return (
    <MotiPressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={label}
      style={[
        styles.base,
        {
          height: s.height,
          paddingHorizontal: s.px,
          borderRadius: radius.button,
          backgroundColor: resolved.bg,
          borderColor: resolved.border,
        },
        full && styles.full,
        isDisabled && !isInactiveFilled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={resolved.fg} size="small" />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={s.fontSize + 2}
              color={resolved.fg}
              style={styles.iconLeft}
            />
          )}
          <Text style={[styles.label, { color: resolved.fg, fontSize: s.fontSize }]}>
            {label}
          </Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={s.fontSize + 2}
              color={resolved.fg}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </MotiPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  full: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  label: { fontWeight: '700', letterSpacing: 0.1 },
});
