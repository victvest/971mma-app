import React from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/shared/theme';

export type GlassTint =
  | 'light'
  | 'dark'
  | 'default'
  | 'prominent'
  | 'regular'
  | 'extraLight'
  | 'systemChromeMaterialLight'
  | 'systemChromeMaterialDark'
  | 'systemMaterialLight'
  | 'systemMaterialDark';

export type GlassCardVariant = 'light' | 'dark';

const GLASS_INTENSITY = { light: 48, dark: 64 } as const;

type Props = {
  children: React.ReactNode;
  variant?: GlassCardVariant;
  borderRadius?: number;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** When false, omits the specular top highlight. */
  showSpecular?: boolean;
};

function resolveBlurTint(variant: GlassCardVariant): 'systemMaterial' | 'systemMaterialDark' {
  return variant === 'dark' ? 'systemMaterialDark' : 'systemMaterial';
}

function resolveFallbackBackground(variant: GlassCardVariant): string {
  return variant === 'dark' ? 'rgba(10, 19, 16, 0.92)' : 'rgba(255, 255, 255, 0.78)';
}

function resolveBorderColor(variant: GlassCardVariant): string {
  return variant === 'dark' ? 'rgba(255, 255, 255, 0.14)' : 'rgba(255, 255, 255, 0.52)';
}

export function GlassCard({
  children,
  variant = 'light',
  borderRadius,
  padded = true,
  style,
  contentStyle,
  showSpecular = true,
}: Props) {
  const { radius, inset } = useTheme();
  const resolvedRadius = borderRadius ?? radius.cardLarge;
  const borderColor = resolveBorderColor(variant);

  const shellStyle = [
    styles.shell,
    {
      borderRadius: resolvedRadius,
      borderColor,
    },
    style,
  ];

  const innerStyle = [padded && { padding: inset.md }, contentStyle];

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={GLASS_INTENSITY[variant]}
        tint={resolveBlurTint(variant)}
        style={shellStyle}
      >
        {showSpecular ? (
          <View
            pointerEvents="none"
            style={[
              styles.specular,
              { borderTopLeftRadius: resolvedRadius, borderTopRightRadius: resolvedRadius },
            ]}
          />
        ) : null}
        <View style={innerStyle}>{children}</View>
      </BlurView>
    );
  }

  return (
    <View
      style={[
        shellStyle,
        {
          backgroundColor: resolveFallbackBackground(variant),
        },
      ]}
    >
      {showSpecular ? (
        <View
          pointerEvents="none"
          style={[
            styles.specular,
            {
              backgroundColor: variant === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.55)',
              borderTopLeftRadius: resolvedRadius,
              borderTopRightRadius: resolvedRadius,
            },
          ]}
        />
      ) : null}
      <View style={innerStyle}>{children}</View>
    </View>
  );
}

/** Compact frosted chip for media overlays (hero badges, status pills). */
export function GlassMediaChip({
  children,
  style,
  live = false,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Solid live tint — blur alone is too faint for urgency chips. */
  live?: boolean;
}) {
  if (live) {
    return <View style={[styles.chip, styles.chipLive, style]}>{children}</View>;
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.chipShell, style]}>
        <BlurView intensity={52} tint="systemThinMaterialDark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.chipDarkVeil} />
        <View style={styles.chipContent}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.chip, styles.chipFallback, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 0.5,
    overflow: 'hidden',
    position: 'relative',
  },
  specular: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  chipShell: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    borderWidth: 0.5,
    flexDirection: 'row',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
    position: 'relative',
  },
  chipDarkVeil: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  chipContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    zIndex: 1,
  },
  chip: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: 999,
    borderWidth: 0.5,
    flexDirection: 'row',
    gap: 6,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipLive: {
    backgroundColor: 'rgba(232, 25, 44, 0.92)',
    borderColor: 'rgba(255,255,255,0.32)',
  },
  chipFallback: {
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
});
