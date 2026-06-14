import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme';

type Props = {
  /** Accent color of the dominant glow blob. */
  tone?: 'green' | 'red' | 'gold' | 'mixed';
};

/**
 * Ambient depth layer for the dark canvas: a base vertical gradient plus a few
 * large, soft colored "aurora" blobs that give the liquid-glass surfaces
 * something rich to refract. Purely decorative — non-interactive.
 */
export function AuroraBackground({ tone = 'mixed' }: Props) {
  const secondary = tone === 'red' ? palette.red : tone === 'gold' ? palette.gold : palette.greenCore;
  const ember = tone === 'gold' ? palette.gold : palette.red;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[palette.ink800, palette.ink900, palette.abyss]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Top-left signature green glow */}
      <View
        style={[
          styles.blob,
          styles.topLeft,
          { backgroundColor: palette.green, shadowColor: palette.green, opacity: 0.5 },
        ]}
      />
      {/* Top-right secondary glow */}
      <View
        style={[
          styles.blob,
          styles.topRight,
          {
            backgroundColor: secondary,
            shadowColor: secondary,
            opacity: 0.4,
          },
        ]}
      />
      {/* Bottom accent ember */}
      <View
        style={[
          styles.blob,
          styles.bottom,
          { backgroundColor: ember, shadowColor: ember, opacity: 0.34 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 300,
    // Large colored shadow softens the disc into an ambient glow (web box-shadow
    // + iOS colored shadow). Fill opacity is kept low via the inline `opacity`.
    shadowColor: palette.green,
    shadowOpacity: 0.9,
    shadowRadius: 120,
    shadowOffset: { width: 0, height: 0 },
  },
  topLeft: { top: -160, left: -130 },
  topRight: { top: -110, right: -150 },
  bottom: { bottom: -170, left: 30 },
});
