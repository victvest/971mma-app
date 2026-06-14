import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, glow, palette, radii, spacing } from '../theme';

type Variant = 'primary' | 'dark' | 'outline' | 'soft' | 'danger';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
  full?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  full = true,
}: Props) {
  const v = VARIANTS[variant];
  const isDisabled = disabled || loading;

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {icon && <Ionicons name={icon} size={18} color={v.fg} style={styles.icon} />}
          <Text style={[styles.label, { color: v.fg }]}>{label}</Text>
        </View>
      )}
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      style={({ pressed }) => [
        styles.shell,
        full && styles.full,
        v.glow && !isDisabled ? v.glow : null,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {v.gradient ? (
        <LinearGradient
          colors={v.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.base, full && styles.full]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.base, full && styles.full, { backgroundColor: v.bg, borderColor: v.border, borderWidth: v.border ? 1.5 : 0 }]}>
          {content}
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<
  Variant,
  { bg?: string; fg: string; border?: string; gradient?: readonly [string, string, ...string[]]; glow?: object }
> = {
  primary: {
    fg: '#FFFFFF',
    gradient: [palette.greenBright, palette.green, palette.greenDeep],
    glow: glow.green,
  },
  dark: { bg: palette.black, fg: '#fff', border: palette.black },
  outline: { bg: 'transparent', fg: colors.text, border: colors.borderStrong },
  soft: { bg: palette.greenGlass, fg: palette.green, border: palette.greenLine },
  danger: { fg: '#fff', gradient: [palette.redBright, palette.red, palette.redDeep], glow: glow.red },
};

const styles = StyleSheet.create({
  shell: { borderRadius: radii.md },
  base: {
    height: 56,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  full: { alignSelf: 'stretch' },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginRight: spacing.sm },
  label: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: 0.2 },
});
