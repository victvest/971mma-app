import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/shared/theme';

type Props = {
  children: React.ReactNode;
  active?: boolean;
};

export function BeltPathIconBadge({ children, active = false }: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: active ? colors.accent.subtle : colors.fill.secondary,
        },
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
