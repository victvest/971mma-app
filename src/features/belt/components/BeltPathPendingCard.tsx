import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BeltPathSurfaceCard } from '@/features/belt/components/BeltPathSurfaceCard';
import { useTheme } from '@/shared/theme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
};

export function BeltPathPendingCard({ icon, title, message }: Props) {
  const { colors, typography, gap, inset } = useTheme();

  return (
    <BeltPathSurfaceCard style={{ gap: gap.md }}>
      <View style={[styles.row, { gap: gap.md }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accent.subtle }]}>
          <Ionicons name={icon} size={22} color={colors.accent.default} />
        </View>
        <View style={[styles.copy, { gap: gap.xs, paddingRight: inset.xs }]}>
          <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary }]}>{title}</Text>
          <Text style={[typography.textPresets.footnote, { color: colors.text.secondary, lineHeight: 18 }]}>
            {message}
          </Text>
        </View>
      </View>
    </BeltPathSurfaceCard>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  copy: {
    flex: 1,
  },
});
