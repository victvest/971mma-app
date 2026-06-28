import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { UAE } from '@/features/home/components/navigation/uaeChrome';

export type UaeBrandAmbientGlowVariant = 'photo-hero' | 'photo-card';

type GlowStop = {
  offset: string;
  opacity: number;
};

type Props = {
  variant?: UaeBrandAmbientGlowVariant;
  topInset?: number;
  showRedAccent?: boolean;
  style?: StyleProp<ViewStyle>;
};

const GREEN_STOPS: Record<UaeBrandAmbientGlowVariant, GlowStop[]> = {
  'photo-hero': [
    { offset: '0%', opacity: 0.52 },
    { offset: '42%', opacity: 0.2 },
    { offset: '100%', opacity: 0 },
  ],
  'photo-card': [
    { offset: '0%', opacity: 0.34 },
    { offset: '48%', opacity: 0.12 },
    { offset: '100%', opacity: 0 },
  ],
};

const RED_STOPS: Record<UaeBrandAmbientGlowVariant, GlowStop[]> = {
  'photo-hero': [
    { offset: '0%', opacity: 0.2 },
    { offset: '50%', opacity: 0.08 },
    { offset: '100%', opacity: 0 },
  ],
  'photo-card': [
    { offset: '0%', opacity: 0.14 },
    { offset: '50%', opacity: 0.05 },
    { offset: '100%', opacity: 0 },
  ],
};

const GREEN_POSITION: Record<UaeBrandAmbientGlowVariant, { cx: string; cy: string; rx: string; ry: string }> = {
  'photo-hero': { cx: '50%', cy: '0%', rx: '82%', ry: '72%' },
  'photo-card': { cx: '50%', cy: '0%', rx: '78%', ry: '64%' },
};

const RED_POSITION: Record<UaeBrandAmbientGlowVariant, { cx: string; cy: string; rx: string; ry: string }> = {
  'photo-hero': { cx: '92%', cy: '88%', rx: '52%', ry: '42%' },
  'photo-card': { cx: '90%', cy: '92%', rx: '46%', ry: '36%' },
};

function RadialGlowLayer({
  gradientId,
  color,
  stops,
  position,
}: {
  gradientId: string;
  color: string;
  stops: GlowStop[];
  position: { cx: string; cy: string; rx: string; ry: string };
}) {
  return (
    <>
      <Defs>
        <RadialGradient
          id={gradientId}
          cx={position.cx}
          cy={position.cy}
          rx={position.rx}
          ry={position.ry}
        >
          {stops.map((stop) => (
            <Stop
              key={stop.offset}
              offset={stop.offset}
              stopColor={color}
              stopOpacity={stop.opacity}
            />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
    </>
  );
}

/** UAE green/red ambient wash for photo and image surfaces only. */
export function UaeBrandAmbientGlow({
  variant = 'photo-card',
  topInset = 0,
  showRedAccent = true,
  style,
}: Props) {
  const baseId = useId().replace(/:/g, '');
  const greenId = `${baseId}-green`;
  const redId = `${baseId}-red`;
  const scrimHeight = topInset + 72;

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer, style]} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <RadialGlowLayer
          gradientId={greenId}
          color={UAE.green}
          stops={GREEN_STOPS[variant]}
          position={GREEN_POSITION[variant]}
        />
        {showRedAccent ? (
          <RadialGlowLayer
            gradientId={redId}
            color={UAE.red}
            stops={RED_STOPS[variant]}
            position={RED_POSITION[variant]}
          />
        ) : null}
      </Svg>

      {variant === 'photo-hero' ? (
        <LinearGradient
          colors={['rgba(0,0,0,0.44)', 'rgba(0,0,0,0.14)', 'transparent']}
          locations={[0, 0.48, 1]}
          style={[styles.topScrim, { height: scrimHeight }]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 1,
  },
  topScrim: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
