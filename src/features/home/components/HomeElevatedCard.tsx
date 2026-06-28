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
 * Crisp white card on the white screen canvas.
 * Border + shadow keep the surface readable without relying on off-white backgrounds.
 */
export function HomeElevatedCard({
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
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
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
