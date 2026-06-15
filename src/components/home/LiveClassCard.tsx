import React from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, palette, radii, shadow, spacing } from '../../theme';

type Props = {
  image: ImageSourcePropType;
  discipline: string;
  time: string;
  title: string;
  focus: string;
  coach: string;
  liveInMin?: number;
  spotsLeft?: number;
  onCheckIn: () => void;
};

export function LiveClassCard({
  image,
  discipline,
  time,
  title,
  focus,
  coach,
  liveInMin = 38,
  spotsLeft = 4,
  onCheckIn,
}: Props) {
  return (
    <View style={[styles.shell, shadow.card]}>
      <Image source={image} style={styles.image} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.88)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.badges}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE · IN {liveInMin} MIN</Text>
        </View>
        <View style={styles.spotsBadge}>
          <Text style={styles.spotsText}>{spotsLeft} SPOTS</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.meta}>{discipline.toUpperCase()} · {time}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.focus}>{focus} · {coach}</Text>
        <View style={styles.actions}>
          <Pressable onPress={onCheckIn} style={styles.checkBtn} accessibilityRole="button">
            <Ionicons name="qr-code" size={16} color="#fff" />
            <Text style={styles.checkText}>Check in</Text>
          </Pressable>
          <View style={styles.walkHint}>
            <Text style={styles.walkText}>Walk in · no booking</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: radii.xxl, overflow: 'hidden', minHeight: 280, backgroundColor: palette.black },
  image: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  badges: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.green,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.6 },
  spotsBadge: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  spotsText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.5 },
  body: { flex: 1, justifyContent: 'flex-end', padding: spacing.xl },
  meta: { fontFamily: fonts.semi, fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: 0.8 },
  title: { fontFamily: fonts.displayBlack, fontSize: 28, color: '#fff', marginTop: 6, letterSpacing: 0.2 },
  focus: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(255,255,255,0.82)', marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  checkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: palette.green,
    paddingHorizontal: spacing.lg,
    height: 44,
    borderRadius: radii.pill,
  },
  checkText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  walkHint: {
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  walkText: { fontFamily: fonts.semi, fontSize: 12, color: 'rgba(255,255,255,0.9)' },
});
