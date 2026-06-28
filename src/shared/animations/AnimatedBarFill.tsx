import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  percent: number;
  backgroundColor: string;
  isHighlighted?: boolean;
  highlightColor?: string;
  trackColor: string;
};

export function AnimatedBarFill({
  percent,
  backgroundColor,
  isHighlighted = false,
  highlightColor,
  trackColor,
}: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View style={[styles.track, { backgroundColor: trackColor }]}>
      <View
        style={[
          styles.fill,
          {
            height: `${clamped}%`,
            backgroundColor: isHighlighted && highlightColor ? highlightColor : backgroundColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 4,
    flex: 1,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: 4,
    width: '100%',
  },
});
