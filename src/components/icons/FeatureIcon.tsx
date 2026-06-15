import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { palette } from '../../theme';

type Tone = 'green' | 'gold' | 'red' | 'ink';

const TONE: Record<Tone, { a: string; b: string; c: string }> = {
  green: { a: palette.greenBright, b: palette.green, c: palette.greenDeep },
  gold: { a: palette.goldBright, b: palette.gold, c: palette.goldDeep },
  red: { a: palette.redBright, b: palette.red, c: palette.redDeep },
  ink: { a: '#4A5560', b: palette.black, c: '#1A1F24' },
};

type Props = {
  name: 'training' | 'rewards' | 'belt' | 'pass' | 'schedule' | 'home' | 'profile' | 'gift' | 'flame' | 'time';
  size?: number;
  tone?: Tone;
  style?: ViewStyle;
};

/** Layered SVG icons with gradient depth — reads as soft 3D on glass surfaces. */
export function FeatureIcon({ name, size = 40, tone = 'green', style }: Props) {
  const c = TONE[tone];
  const s = size;

  return (
    <View style={[styles.wrap, { width: s, height: s }, style]}>
      <Svg width={s} height={s} viewBox="0 0 48 48">
        <Defs>
          <LinearGradient id={`g-${name}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.a} />
            <Stop offset="0.55" stopColor={c.b} />
            <Stop offset="1" stopColor={c.c} />
          </LinearGradient>
          <LinearGradient id={`shine-${name}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="rgba(255,255,255,0.55)" />
            <Stop offset="1" stopColor="rgba(255,255,255,0)" />
          </LinearGradient>
        </Defs>
        <Ellipse cx="24" cy="42" rx="14" ry="3" fill="rgba(15,23,18,0.12)" />
        <Rect x="6" y="6" width="36" height="36" rx="12" fill={`url(#g-${name})`} />
        <Rect x="6" y="6" width="36" height="18" rx="12" fill={`url(#shine-${name})`} />
        {glyph(name)}
      </Svg>
    </View>
  );
}

function glyph(name: Props['name']) {
  const white = 'rgba(255,255,255,0.95)';
  switch (name) {
    case 'training':
      return (
        <>
          <Path d="M16 30 L24 14 L32 30 Z" fill={white} opacity={0.95} />
          <Rect x="22" y="28" width="4" height="8" rx="1" fill={white} />
        </>
      );
    case 'rewards':
    case 'gift':
      return (
        <>
          <Rect x="15" y="22" width="18" height="14" rx="3" fill={white} />
          <Rect x="22" y="14" width="4" height="22" fill={white} />
          <Rect x="15" y="20" width="18" height="4" fill={white} opacity={0.85} />
        </>
      );
    case 'belt':
      return (
        <>
          <Rect x="12" y="24" width="24" height="8" rx="2" fill={white} />
          <Rect x="18" y="22" width="3" height="12" rx="1" fill={white} opacity={0.9} />
          <Rect x="24" y="22" width="3" height="12" rx="1" fill={white} opacity={0.7} />
          <Rect x="30" y="22" width="3" height="12" rx="1" fill={white} opacity={0.5} />
        </>
      );
    case 'pass':
      return (
        <>
          <Rect x="14" y="14" width="20" height="20" rx="3" fill={white} />
          <Rect x="17" y="17" width="5" height="5" fill="rgba(15,23,18,0.85)" />
          <Rect x="26" y="17" width="5" height="5" fill="rgba(15,23,18,0.85)" />
          <Rect x="17" y="26" width="5" height="5" fill="rgba(15,23,18,0.85)" />
          <Rect x="26" y="26" width="3" height="3" fill="rgba(15,23,18,0.85)" />
        </>
      );
    case 'schedule':
      return (
        <>
          <Rect x="14" y="16" width="20" height="18" rx="3" fill={white} />
          <Rect x="14" y="16" width="20" height="6" fill="rgba(255,255,255,0.7)" />
          <Rect x="18" y="26" width="4" height="4" rx="1" fill="rgba(15,23,18,0.75)" />
          <Rect x="26" y="26" width="4" height="4" rx="1" fill="rgba(15,23,18,0.75)" />
        </>
      );
    case 'home':
      return <Path d="M14 22 L24 13 L34 22 V34 H14 Z" fill={white} />;
    case 'profile':
      return (
        <>
          <Circle cx="24" cy="19" r="6" fill={white} />
          <Path d="M14 36 C14 30 18 27 24 27 C30 27 34 30 34 36" fill={white} />
        </>
      );
    case 'flame':
      return (
        <Path
          d="M24 12 C20 20 16 22 16 28 C16 33 19 36 24 36 C29 36 32 33 32 28 C32 22 28 20 24 12 Z"
          fill={white}
        />
      );
    case 'time':
      return (
        <>
          <Circle cx="24" cy="24" r="11" stroke={white} strokeWidth="2.5" fill="none" />
          <Path d="M24 17 V24 L29 27" stroke={white} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
