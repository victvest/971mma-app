import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';
import type { GlassTint } from './GlassCard';

type IOSGlassSurfaceProps = {
  children: React.ReactNode;
  intensity?: number;
  tint?: GlassTint;
  borderRadius?: number;
  overlayOpacity?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blurTarget?: React.RefObject<any>;
};

export function IOSGlassSurface({
  children,
  borderRadius = 28,
  style,
  contentStyle,
}: IOSGlassSurfaceProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.shell,
        {
          borderRadius,
          borderColor: colors.border.subtle,
          backgroundColor: colors.surface.secondary,
        },
        style,
      ]}
    >
      <View style={[styles.contentLayer, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 0.5,
    overflow: 'hidden',
    position: 'relative',
  },
  contentLayer: {
    flex: 1,
  },
});
