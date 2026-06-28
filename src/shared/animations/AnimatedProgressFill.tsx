import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  percent: number;
  backgroundColor: string;
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
};

export function AnimatedProgressFill({ percent, backgroundColor, style, borderRadius = 2 }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View
      style={[
        { height: '100%', borderRadius, backgroundColor, width: `${clamped}%` },
        style,
      ]}
    />
  );
}
