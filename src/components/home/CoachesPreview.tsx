import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { GlassCard } from '../../ui';
import { colors, fonts, palette, spacing } from '../../theme';

export type CoachProfile = {
  id: string;
  name: string;
  role: string;
  belt: string;
  rating: number;
  image: ImageSourcePropType;
};

type Props = {
  coaches: CoachProfile[];
  onSeeAll?: () => void;
  onCoach?: (id: string) => void;
};

export function CoachesPreview({ coaches, onSeeAll, onCoach }: Props) {
  const lead = coaches[0];
  if (!lead) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="titleLarge" style={styles.title}>Your coaches</Text>
        <Pressable onPress={onSeeAll} style={styles.seeAll} accessibilityRole="button">
          <Text style={styles.seeAllText}>See all</Text>
          <Icon source="arrow-right" size={14} color={palette.green} />
        </Pressable>
      </View>
      <Pressable onPress={() => onCoach?.(lead.id)} accessibilityRole="button">
        <GlassCard>
          <View style={styles.card}>
            <Image source={lead.image} style={styles.photo} resizeMode="cover" />
            <View style={styles.body}>
              <View style={styles.rating}>
                <Icon source="star" size={12} color={palette.green} />
                <Text style={styles.ratingText}>{lead.rating.toFixed(1)}</Text>
              </View>
              <Text style={styles.role}>{lead.role}</Text>
              <Text variant="titleMedium" style={styles.name}>{lead.name}</Text>
              <Text variant="bodySmall" style={styles.belt}>{lead.belt}</Text>
            </View>
          </View>
        </GlassCard>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.xxl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontFamily: fonts.bold, color: colors.text },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seeAllText: { fontFamily: fonts.semi, fontSize: 13, color: palette.green },
  card: { flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  photo: { width: 88, height: 88, borderRadius: 16 },
  body: { flex: 1, justifyContent: 'center' },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  role: { fontFamily: fonts.bold, fontSize: 10, color: colors.textFaint, letterSpacing: 0.8, marginTop: 6 },
  name: { fontFamily: fonts.bold, color: colors.text, marginTop: 2 },
  belt: { fontFamily: fonts.medium, color: colors.textMuted, marginTop: 4 },
});
