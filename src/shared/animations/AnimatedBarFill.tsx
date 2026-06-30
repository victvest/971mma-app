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
  borderRadius?: number;
  trackBorderColor?: string;
};

export function AnimatedBarFill({
  percent,
  backgroundColor,
  isHighlighted = false,
  highlightColor,
  trackColor,
  trackHeight = 40,
  minFillHeight = 4,
  borderRadius = 8,
  trackBorderColor,
}: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const fillHeight =
    clamped > 0 ? Math.max(minFillHeight, Math.round((clamped / 100) * trackHeight)) : 0;
  const fillColor = isHighlighted && highlightColor ? highlightColor : backgroundColor;
  const isFull = fillHeight >= trackHeight;

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: trackColor,
          borderColor: trackBorderColor,
          borderRadius,
          borderWidth: trackBorderColor ? StyleSheet.hairlineWidth : 0,
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
              borderBottomLeftRadius: borderRadius,
              borderBottomRightRadius: borderRadius,
              borderTopLeftRadius: isFull ? borderRadius : 0,
              borderTopRightRadius: isFull ? borderRadius : 0,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    width: '100%',
  },
});
