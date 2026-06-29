import React from 'react';
import { StyleSheet, View } from 'react-native';

type Props = {
  percent: number;
  backgroundColor: string;
  isHighlighted?: boolean;
  highlightColor?: string;
  trackColor: string;
  trackHeight?: number;
  minFillHeight?: number;
};

export function AnimatedBarFill({
  percent,
  backgroundColor,
  isHighlighted = false,
  highlightColor,
  trackColor,
  trackHeight = 40,
  minFillHeight = 4,
}: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const fillHeight =
    clamped > 0 ? Math.max(minFillHeight, Math.round((clamped / 100) * trackHeight)) : 0;
  const fillColor = isHighlighted && highlightColor ? highlightColor : backgroundColor;

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: trackColor,
          height: trackHeight,
        },
      ]}
    >
      {fillHeight > 0 ? (
        <View
          style={[
            styles.fill,
            {
              height: fillHeight,
              backgroundColor: fillColor,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    borderRadius: 4,
    width: '100%',
  },
});
