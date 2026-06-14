import React from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { glass, palette, radii, shadow, spacing } from '../theme';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number | false;
  radius?: number;
  strong?: boolean;
  tone?: 'neutral' | 'green' | 'red' | 'gold';
  sheen?: boolean;
};

const TONE_EDGE: Record<NonNullable<Props['tone']>, string> = {
  neutral: 'rgba(255,255,255,0.9)',
  green: 'rgba(21,99,58,0.24)',
  red: 'rgba(225,24,43,0.2)',
  gold: 'rgba(168,132,47,0.24)',
};

/** Frosted liquid-glass panel — blur + translucent fill + specular rim. */
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
  const blur = strong ? glass.blurStrong : glass.blur;
  const bodyAlpha = strong ? 0.52 : 0.38;

  return (
    <View style={[styles.shell, strong ? shadow.card : shadow.soft, { borderRadius: radius }, style]}>
      <View
        style={[
          styles.clip,
          { borderRadius: radius, borderColor: TONE_EDGE[tone] },
          Platform.OS === 'web' && ({ backdropFilter: `blur(${blur}px) saturate(180%)` } as any),
        ]}
      >
        <BlurView intensity={blur} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(255,255,255,${bodyAlpha})` }]} />
        {sheen ? (
          <>
            <LinearGradient
              colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.4)', 'rgba(255,255,255,0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 0.55 }}
              style={styles.specular}
              pointerEvents="none"
            />
            <View style={styles.topRim} pointerEvents="none" />
            <LinearGradient
              colors={['rgba(255,255,255,0.6)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.sideSheen}
              pointerEvents="none"
            />
          </>
        ) : null}
        <LinearGradient
          colors={['rgba(255,255,255,0)', 'rgba(15,23,18,0.05)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.depth}
          pointerEvents="none"
        />
        <View style={{ padding: pad }}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {},
  clip: {
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomColor: 'rgba(15,23,18,0.1)',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  topRim: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderRadius: 1,
  },
  sideSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '40%',
    bottom: 0,
  },
  depth: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
  },
});
