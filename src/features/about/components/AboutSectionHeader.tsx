import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

type Props = {
  kicker: string;
  title?: string;
};

export function AboutSectionHeader({ kicker, title }: Props) {
  const { colors, gap } = useTheme();

  return (
    <View style={[styles.wrap, { gap: gap.xs }]}>
      <Text style={[styles.kicker, { color: colors.text.tertiary }]}>{kicker}</Text>
      {title ? (
        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 32,
  },
});
