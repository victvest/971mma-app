import React, { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppScrollView } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

type Props = {
  children: ReactNode;
  /** Gap between child cards, defaults to 12 */
  cardGap?: number;
};

/**
 * Horizontal scroll wrapper for home screen coach cards.
 *
 * - Breaks out of screen padding with negative margins so cards render edge-to-edge.
 * - Restores inner padding so first/last card aligns with the rest of the screen content.
 */
export const HomeCoachesScroll = memo(function HomeCoachesScroll({ children, cardGap = 12 }: Props) {
  const { inset } = useTheme();

  return (
    <View style={[styles.wrap, { marginHorizontal: -inset.lg }]}>
      <AppScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingHorizontal: inset.lg, gap: cardGap }]}
      >
        {children}
      </AppScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 4,
  },
  content: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
});
