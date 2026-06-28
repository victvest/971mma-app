import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function BeltPathSurfaceCard({ children, style }: Props) {
  const { colors, radius, shadows, inset } = useTheme();

  return (
    <View style={[shadows.card, { borderRadius: radius.cardLarge }]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface.primary,
            borderRadius: radius.cardLarge,
            padding: inset.lg,
          },
          style,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
});
