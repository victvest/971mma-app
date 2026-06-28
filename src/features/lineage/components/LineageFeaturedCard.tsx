import React from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { academyAssets } from '@/features/academy/assets';
import { MediaBackground } from '@/shared/components/MediaBackground';
import { useTheme } from '@/shared/theme';
import type { LineageEntryItem } from '@/types/domain';

type LineageFeaturedCardProps = {
  entries: LineageEntryItem[];
};

function shortLineageName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'Academy';
  if (/^coach\s+/i.test(trimmed)) {
    const parts = trimmed.replace(/^coach\s+/i, '').split(/\s+/);
    return parts[0] ?? trimmed;
  }
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function LineageFeaturedCard({ entries }: LineageFeaturedCardProps) {
  const { colors, inset, radius, layout, gap } = useTheme();

  const first = entries[0];
  const last = entries[entries.length - 1];
  const pathLabel =
    first && last
      ? `${shortLineageName(first.name).toUpperCase()} → ${shortLineageName(last.name).toUpperCase()}`
      : '971 MMA ACADEMY';
  const generationLine =
    entries.length >= 2
      ? `${entries.length} generations of grappling.`
      : 'The academy story from roots to today.';

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius.cardLarge,
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: layout.borderWidth,
          overflow: 'hidden',
          marginBottom: 20,
        },
      ]}
    >
      <MediaBackground
        source={academyAssets.nextLevelBjj}
        style={styles.imageBg}
        borderRadius={radius.cardLarge}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.surface.promo, opacity: 0.72 }]} />
        <View style={[styles.bottomScrim, { backgroundColor: colors.media.scrimBottom, opacity: 0.92 }]} />
        <View style={[styles.content, { padding: inset.lg, gap: gap.md }]}>
          <View style={styles.logoRow}>
            <Image
              source={academyAssets.logoOfficial}
              style={styles.logo}
              contentFit="contain"
              cachePolicy="memory-disk"
              accessibilityLabel="Next Level Jiu Jitsu"
            />
            <View style={styles.logoTextCol}>
              <Text style={styles.logoTitle}>NEXT LEVEL</Text>
              <Text style={styles.logoSubtitle}>JIU JITSU</Text>
            </View>
          </View>

          <Text style={[styles.pathLabel, { color: colors.accent.default }]}>{pathLabel}</Text>
          <Text style={styles.generationText}>{generationLine}</Text>
        </View>
      </MediaBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {},
  imageBg: {
    minHeight: 200,
  },
  content: {
    minHeight: 200,
    justifyContent: 'flex-end',
    zIndex: 1,
  },
  bottomScrim: {
    bottom: 0,
    height: '75%',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 48,
    height: 48,
  },
  logoTextCol: {
    gap: 0,
  },
  logoTitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  logoSubtitle: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pathLabel: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.6,
    marginTop: 4,
  },
  generationText: {
    color: '#8A928F',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
