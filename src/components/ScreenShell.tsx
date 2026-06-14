import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

/**
 * Clean screen canvas — flat off-white with a soft vertical wash so frosted
 * glass cards have depth to refract. No decorative blobs.
 */
export function ScreenShell({ children, style }: Props) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={['#FCFDFC', '#F6F9F7', '#EEF3EF']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Faint brand wash — gives glass something to blur, not circles */}
      <LinearGradient
        colors={['rgba(21,99,58,0.06)', 'rgba(21,99,58,0)', 'rgba(232,25,44,0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.ink800 },
});
