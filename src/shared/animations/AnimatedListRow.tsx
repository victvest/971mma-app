import React, { type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ScrollRevealCard } from './ScrollRevealCard';

type Props = {
  index: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function AnimatedListRow({ index, children, style }: Props) {
  return (
    <ScrollRevealCard itemId={`animated-list-row-${index}`} index={index} style={style}>
      {children}
    </ScrollRevealCard>
  );
}
