import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, palette, radii, shadow, spacing } from '../../theme';

type Props = {
  image: ImageSourcePropType;
  chain: readonly string[];
  caption: string;
  onPress?: () => void;
};

/** v3 "Know your history" — lineage card with MAEDA → GRACIE → TONY. */
export function LineageHistoryCard({ image, chain, caption, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[styles.card, shadow.soft]} accessibilityRole="button">
      <Image source={image} style={styles.thumb} resizeMode="cover" />
      <View style={styles.body}>
        <Text style={styles.kicker}>KNOW YOUR HISTORY</Text>
        <Text style={styles.title}>Belt & lineage</Text>
        <Text style={styles.caption}>{caption}</Text>
        <View style={styles.chain}>
          {chain.map((name, i) => (
            <React.Fragment key={name}>
              <Text style={styles.chainName}>{name}</Text>
              {i < chain.length - 1 ? (
                <Ionicons name="arrow-forward" size={12} color={colors.textFaint} />
              ) : null}
            </React.Fragment>
          ))}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: palette.hairline,
    padding: spacing.md,
  },
  thumb: { width: 72, height: 72, borderRadius: radii.md },
  body: { flex: 1 },
  kicker: { fontFamily: fonts.bold, fontSize: 9, color: palette.red, letterSpacing: 1 },
  title: { fontFamily: fonts.bold, fontSize: 16, color: colors.text, marginTop: 4 },
  caption: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chain: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, flexWrap: 'wrap' },
  chainName: { fontFamily: fonts.bold, fontSize: 11, color: palette.green, letterSpacing: 0.6 },
});
