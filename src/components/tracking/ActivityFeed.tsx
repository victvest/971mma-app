import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, motion, palette, radii, spacing } from '../../theme';
import { AppIcon } from '../icons/FeatureIcon';
import { recentActivity } from '../../data/mockData';

type Accent = 'green' | 'red' | 'ink' | 'gold';

const ACCENT_ICON: Record<Accent, 'training' | 'belt' | 'schedule' | 'rewards'> = {
  green: 'training',
  red: 'belt',
  ink: 'schedule',
  gold: 'rewards',
};

const ACCENT_TONE: Record<Accent, 'green' | 'red' | 'ink' | 'gold'> = {
  green: 'green',
  red: 'red',
  ink: 'ink',
  gold: 'gold',
};

type Props = {
  onViewAll?: () => void;
};

/** Compact recent activity feed for Home — check-ins, belt notes, rewards. */
export function ActivityFeed({ onViewAll }: Props) {
  return (
    <View style={styles.wrap}>
      {recentActivity.map((item, index) => (
        <ActivityRow key={item.id} index={index} {...item} />
      ))}
      {onViewAll ? (
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            onViewAll();
          }}
          style={({ pressed }) => [styles.viewAll, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={styles.viewAllText}>View full training history</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function ActivityRow({
  title,
  detail,
  time,
  accent,
  index,
}: {
  title: string;
  detail: string;
  time: string;
  accent: Accent;
  index: number;
}) {
  const slide = useRef(new Animated.Value(18)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, {
        toValue: 0,
        delay: index * motion.stagger,
        ...motion.springSoft,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: motion.duration.normal,
        delay: index * motion.stagger,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, index, slide]);

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.98, ...motion.springSoft }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, ...motion.spring }).start();
  };

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }, { scale }] }}>
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={styles.row}
        accessibilityRole="button"
      >
        <AppIcon name={ACCENT_ICON[accent]} size={38} tone={ACCENT_TONE[accent]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.detail} numberOfLines={1}>{detail}</Text>
        </View>
        <Text style={styles.time}>{time}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.md,
  },
  title: { fontFamily: fonts.semi, fontSize: 14, color: colors.text },
  detail: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  time: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint },
  viewAll: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  viewAllText: { fontFamily: fonts.semi, fontSize: 13, color: palette.red },
});
