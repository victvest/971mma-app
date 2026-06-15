import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { palette } from '../theme';

type Props = { width?: number; height?: number; style?: ViewStyle };

/** Compact UAE flag for headers and cards. */
export function UaeFlagIcon({ width = 18, height = 12, style }: Props) {
  return (
    <View style={[styles.wrap, { width, height }, style]}>
      <View style={[styles.green, { width: width * 0.28 }]} />
      <View style={styles.stripes}>
        <View style={[styles.white, { height: '33.33%' }]} />
        <View style={[styles.black, { height: '33.33%' }]} />
        <View style={[styles.red, { height: '33.34%' }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: 2, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.08)' },
  green: { backgroundColor: palette.green, height: '100%' },
  stripes: { flex: 1 },
  white: { backgroundColor: palette.white },
  black: { backgroundColor: palette.black },
  red: { backgroundColor: palette.red },
});
