import React from 'react';
import { Platform, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';

type ShimmerSurfaceProps = {
  children: React.ReactNode;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

export function ShimmerSurface({
  children,
  borderRadius = 28,
  style,
  contentStyle,
}: ShimmerSurfaceProps) {
  const { colors, layout } = useTheme();

  return (
    <View
      style={[
        styles.shell,
        {
          borderRadius,
          borderColor: colors.border.subtle,
          backgroundColor: colors.background.secondary,
          borderWidth: layout.borderWidth,
        },
        Platform.OS === 'ios'
          ? {
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
            }
          : { elevation: 0 },
        style,
      ]}
    >
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flex: 1,
  },
});
