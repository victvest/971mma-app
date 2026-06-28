import React, { type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

type EntranceKind = 'section' | 'list';

type Props = {
  children: ReactNode;
  index?: number;
  style?: StyleProp<ViewStyle>;
  offsetY?: number;
  offsetX?: number;
  disabled?: boolean;
  kind?: EntranceKind;
};

export function MotiEntrance({ children, style }: Props) {
  if (style) {
    return <View style={style}>{children}</View>;
  }
  return <>{children}</>;
}

type ScreenEntranceProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ScreenEntrance({ children, style }: ScreenEntranceProps) {
  if (style) {
    return <View style={style}>{children}</View>;
  }
  return <>{children}</>;
}
