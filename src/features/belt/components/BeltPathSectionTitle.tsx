import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

type Props = {
  title: string;
};

export function BeltPathSectionTitle({ title }: Props) {
  const { colors, typography, gap } = useTheme();

  return (
    <View style={[styles.root, { marginBottom: gap.sm }]}>
      <Text style={[typography.textPresets.subtitle, styles.title, { color: colors.text.primary }]}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 4,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
