import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { GlassCard } from '../../ui';
import { colors, fonts, palette, spacing } from '../../theme';

type Props = {
  image: ImageSourcePropType;
  chain: readonly string[];
  caption: string;
  onPress?: () => void;
};

export function LineageHistoryCard({ image, chain, caption, onPress }: Props) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <GlassCard style={styles.card}>
        <View style={styles.row}>
          <Image source={image} style={styles.thumb} resizeMode="cover" />
          <View style={styles.body}>
            <Text style={styles.kicker}>KNOW YOUR HISTORY</Text>
            <Text variant="titleMedium" style={styles.title}>Belt & lineage</Text>
            <Text variant="bodySmall" style={styles.caption}>{caption}</Text>
            <View style={styles.chain}>
              {chain.map((name, i) => (
                <React.Fragment key={name}>
                  <Text style={styles.chainName}>{name}</Text>
                  {i < chain.length - 1 ? <Icon source="arrow-right" size={12} color={colors.textFaint} /> : null}
                </React.Fragment>
              ))}
            </View>
          </View>
          <Icon source="chevron-right" size={18} color={colors.textFaint} />
        </View>
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  thumb: { width: 72, height: 72, borderRadius: 16 },
  body: { flex: 1 },
  kicker: { fontFamily: fonts.bold, fontSize: 9, color: palette.red, letterSpacing: 1 },
  title: { fontFamily: fonts.bold, color: colors.text, marginTop: 4 },
  caption: { fontFamily: fonts.medium, color: colors.textMuted, marginTop: 2 },
  chain: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, flexWrap: 'wrap' },
  chainName: { fontFamily: fonts.bold, fontSize: 11, color: palette.green, letterSpacing: 0.6 },
});
