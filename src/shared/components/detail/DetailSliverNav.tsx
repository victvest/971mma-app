import React from 'react';
import type { SharedValue } from 'react-native-reanimated';
import { CollapsibleAppBar } from '@/shared/components/ui/CollapsibleAppBar';

type Props = {
  title: string;
  scrollY: SharedValue<number>;
  heroHeight: number;
};

/**
 * Collapsing app bar for media-heavy detail screens (class, coach).
 * Uses the same chrome as push screens once the hero scrolls away.
 */
export function DetailSliverNav({ title, scrollY, heroHeight }: Props) {
  const collapseStart = Math.max(96, heroHeight * 0.46);
  const collapseEnd = Math.max(collapseStart + 72, heroHeight * 0.72);

  return (
    <CollapsibleAppBar
      title={title}
      scrollY={scrollY}
      collapseStart={collapseStart}
      collapseEnd={collapseEnd}
    />
  );
}
