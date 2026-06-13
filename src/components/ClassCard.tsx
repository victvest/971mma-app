import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadow, spacing } from '../theme';
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Image source={item.image} style={styles.image} />
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
              <Ionicons name="checkmark-circle" size={15} color={colors.accent} />
              <Text style={[styles.spots, { color: colors.accent, fontWeight: '800' }]}>Booked</Text>
            </View>
          ) : full ? (
            <Text style={[styles.spots, { color: colors.danger }]}>Class full · waitlist</Text>
          ) : (
            <Text style={styles.spots}>
              <Text style={{ color: colors.accent, fontWeight: '800' }}>{spotsLeft}</Text> spots left
            </Text>
          )}

          <Pressable
            onPress={onAction}
            disabled={busy || !onAction}
            style={[styles.bookBtn, (booked || full) && styles.waitBtn]}
          >
            {busy ? (
              <ActivityIndicator size="small" color={booked || full ? colors.text : '#fff'} />
            ) : (
              <Text style={[styles.bookText, (booked || full) && { color: colors.text }]}>
                {booked ? 'Cancel' : full ? 'Join waitlist' : 'Book'}
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
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.soft,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  image: { width: 96, height: '100%', minHeight: 132 },
  body: { flex: 1, padding: spacing.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  title: { marginTop: spacing.sm, fontSize: 17, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  meta: { marginTop: 2, fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  footer: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spots: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  bookedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bookBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radii.sm,
    minWidth: 84,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitBtn: { backgroundColor: colors.bgAlt, borderWidth: 1, borderColor: colors.borderStrong },
  bookText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
