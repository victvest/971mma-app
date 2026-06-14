import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { radii, shadow, spacing } from '../theme';
import { GlassSurface } from './GlassSurface';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
  tone?: 'neutral' | 'green' | 'red' | 'gold';
};

export function Card({ children, style, padded = true, elevated = true, tone = 'neutral' }: Props) {
  return (
    <GlassSurface
      tone={tone}
      radius={radii.lg}
      padding={padded ? spacing.xl : false}
      style={[elevated ? shadow.card : shadow.soft, style as any]}
    >
      {children}
    </GlassSurface>
  );
}

// Kept for any external imports expecting a stylesheet; intentionally minimal.
export const cardStyles = StyleSheet.create({ noop: {} });
