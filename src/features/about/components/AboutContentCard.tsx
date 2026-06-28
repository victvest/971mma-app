import React, { type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { Card } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Minimal white bordered card for About screen copy blocks. */
export function AboutContentCard({ children, style }: Props) {
  const { inset, radius } = useTheme();

  return (
    <Card
      padded={false}
      style={[
        {
          borderRadius: radius.cardLarge,
          padding: inset.lg,
        },
        style,
      ]}
    >
      {children}
    </Card>
  );
}
