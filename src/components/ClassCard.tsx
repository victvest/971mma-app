import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, palette, radii, spacing } from '../theme';
import { GymClass } from '../data/mockData';
import { Tag } from './primitives';

type Props = {
  item: GymClass;
  onPress?: () => void;
  onBook?: () => void;
  onCancel?: () => void;
  busy?: boolean;
};

export function ClassCard({ item, onPress, onBook, onCancel, busy }: Props) {
  const booked = !!item.isBooked;
  const full = !booked && item.booked >= item.capacity;
  const spotsLeft = Math.max(0, item.capacity - item.booked);
  const tone = item.accent === 'red' ? 'red' : item.accent === 'ink' ? 'ink' : 'green';

  const onAction = booked ? onCancel : onBook;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image source={item.image} style={styles.image} />
        <LinearGradient
          colors={['rgba(7,10,15,0)', 'rgba(7,10,15,0.85)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Tag label={item.discipline} tone={tone} />
          <View style={styles.time}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.timeText}>
              {item.startTime}–{item.endTime}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>
          {item.coach} · {item.level}
        </Text>

        <View style={styles.footer}>
          {booked ? (
            <View style={styles.bookedRow}>
              <Ionicons name="checkmark-circle" size={15} color={colors.accentBright} />
              <Text style={[styles.spots, { color: colors.accentBright, fontFamily: fonts.bold }]}>Booked</Text>
            </View>
          ) : full ? (
            <Text style={[styles.spots, { color: palette.redBright }]}>Full · waitlist</Text>
          ) : (
            <Text style={styles.spots}>
              <Text style={{ color: colors.accentBright, fontFamily: fonts.bold }}>{spotsLeft}</Text> spots left
            </Text>
          )}

          <Pressable
            onPress={onAction}
            disabled={busy || !onAction}
            accessibilityRole="button"
            accessibilityLabel={booked ? 'Cancel booking' : full ? 'Join waitlist' : 'Book class'}
            style={({ pressed }) => [
              styles.bookBtn,
              (booked || full) && styles.waitBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={booked || full ? colors.text : '#04150C'} />
            ) : (
              <Text style={[styles.bookText, (booked || full) && { color: colors.text }]}>
                {booked ? 'Cancel' : full ? 'Waitlist' : 'Book'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: palette.glass06,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  imageWrap: { width: 104, minHeight: 134 },
  image: { width: 104, height: '100%' },
  body: { flex: 1, padding: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontFamily: fonts.semi, fontSize: 12, color: colors.textMuted },
  title: { marginTop: spacing.sm, fontFamily: fonts.displayBold, fontSize: 21, color: colors.text, letterSpacing: 0.2 },
  meta: { marginTop: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  footer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spots: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  bookedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bookBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    borderRadius: radii.sm,
    minWidth: 86,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitBtn: { backgroundColor: palette.glass08, borderWidth: 1, borderColor: colors.borderStrong },
  bookText: { color: '#04150C', fontFamily: fonts.bold, fontSize: 13 },
});
