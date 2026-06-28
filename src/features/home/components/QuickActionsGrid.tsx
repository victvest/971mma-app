import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/theme';

type QuickAction = {
  key: string;
  label: string;
  value: string;
  onPress: () => void;
};

type QuickActionsGridProps = {
  actions: QuickAction[];
};

export function QuickActionsGrid({ actions }: QuickActionsGridProps) {
  const { colors, layout } = useTheme();

  return (
    <View style={styles.grid}>
      {actions.map((action) => (
        <Pressable
          key={action.key}
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.tile,
            {
              backgroundColor: colors.background.elevated,
              borderColor: colors.border.subtle,
              borderWidth: layout.borderWidth,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Text style={[styles.label, { color: colors.text.secondary }]}>{action.label}</Text>
          <Text style={[styles.value, { color: colors.text.primary }]}>{action.value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  tile: {
    width: '48%',
    borderRadius: 14,
    padding: 14,
    minHeight: 88,
    justifyContent: 'space-between',
  },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  value: { fontSize: 18, fontWeight: '700', marginTop: 8 },
});
