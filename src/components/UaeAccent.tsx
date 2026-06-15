import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { palette } from '../theme';

const SEGMENTS = [
  palette.green,
  palette.white,
  palette.black,
  palette.red,
] as const;

type StripeProps = {
  /** Horizontal bar (footer/header) or vertical edge strip */
  orientation?: 'horizontal' | 'vertical';
  thickness?: number;
  style?: ViewStyle;
};

/** Four-band UAE flag motif — green · white · black · red */
export function UaeFlagStripe({
  orientation = 'horizontal',
  thickness = 3,
  style,
}: StripeProps) {
  const isRow = orientation === 'horizontal';

  return (
    <View
      style={[
        isRow ? { height: thickness, flexDirection: 'row' } : { width: thickness, flexDirection: 'column' },
        style,
      ]}
    >
      {SEGMENTS.map((color) => (
        <View
          key={color}
          style={[
            isRow ? styles.segH : styles.segV,
            { backgroundColor: color },
            color === palette.white && styles.segWhite,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segH: { flex: 1 },
  segV: { flex: 1 },
  segWhite: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15,23,18,0.08)',
  },
});
