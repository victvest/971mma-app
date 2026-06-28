import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/shared/theme';

type Props = {
  children: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * Dark prestige card for belt path / high-value states on light screens.
 * Solid ink surface + shadow reads clearer than dark blur over a light page.
 */
export function HomeCommandCard({
  children,
  padded = true,
  style,
  contentStyle,
}: Props) {
  const { colors, radius, inset, shadows, layout } = useTheme();

  return (
    <View
      style={[
        styles.shell,
        shadows.cardDark,
        {
          backgroundColor: colors.surface.promo,
          borderColor: colors.border.onPromo,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
        },
        padded && { padding: inset.md },
        style,
        contentStyle,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    position: 'relative',
  },
});
