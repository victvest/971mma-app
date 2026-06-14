import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glass, palette, radii, spacing } from '../theme';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Inner padding preset; pass a number for custom or false for none. */
  padding?: number | false;
  radius?: number;
  /** Stronger frost + brighter fill for hero surfaces. */
  strong?: boolean;
  /** Tinted hairline edge: signature glow color. */
  tone?: 'neutral' | 'green' | 'red' | 'gold';
  /** Subtle top sheen highlight (on by default). */
  sheen?: boolean;
};

const TONE_BORDER: Record<NonNullable<Props['tone']>, string> = {
  neutral: glass.border,
  green: palette.greenLine,
  red: 'rgba(255,59,78,0.35)',
  gold: 'rgba(231,199,122,0.38)',
};

/**
 * Frosted "liquid glass" surface: real backdrop blur (expo-blur, incl. web via
 * backdrop-filter) layered with a translucent fill, a hairline edge and a top
 * sheen so it reads as glass even where blur is subtle.
 */
export function GlassSurface({
  children,
  style,
  padding = spacing.xl,
  radius = radii.lg,
  strong = false,
  tone = 'neutral',
  sheen = true,
}: Props) {
  const pad = padding === false ? 0 : padding;
  return (
    <View
      style={[
        styles.clip,
        { borderRadius: radius, borderColor: TONE_BORDER[tone] },
        style,
      ]}
    >
      <BlurView
        intensity={strong ? glass.blurStrong : glass.blur}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: strong ? glass.fillStrong : glass.fill },
        ]}
      />
      {sheen ? (
        <LinearGradient
          colors={[glass.sheenTop, glass.sheenBottom]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.sheen}
          pointerEvents="none"
        />
      ) : null}
      <View style={{ padding: pad }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
    borderWidth: 1,
    backgroundColor: 'rgba(11,15,22,0.35)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
});
