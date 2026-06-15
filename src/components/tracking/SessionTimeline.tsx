import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, fonts, motion, palette, radii, spacing } from '../../theme';
import { AnimatedNumber } from '../AnimatedNumber';
import { AppIcon } from '../icons/FeatureIcon';
import { GlassSurface } from '../GlassSurface';
import type { TrainingSession } from '../../data/memberFeatures';

type Props = {
  sessions: TrainingSession[];
  /** Global stagger offset when nested in grouped history */
  startIndex?: number;
};

/** Vertical session timeline — spring entrances, growing rail, points pop. */
export function SessionTimeline({ sessions, startIndex = 0 }: Props) {
  return (
    <View style={styles.wrap}>
      {sessions.map((s, i) => (
        <SessionRow
          key={s.id}
          session={s}
          index={startIndex + i}
          isLast={i === sessions.length - 1}
        />
      ))}
    </View>
  );
}

function SessionRow({
  session,
  index,
  isLast,
}: {
  session: TrainingSession;
  index: number;
  isLast: boolean;
}) {
  const slide = useRef(new Animated.Value(28)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const rail = useRef(new Animated.Value(0)).current;
  const points = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const delay = index * motion.stagger;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, delay, ...motion.spring }),
      Animated.timing(fade, {
        toValue: 1,
        duration: motion.duration.normal,
        delay,
        easing: motion.easing.out,
        useNativeDriver: true,
      }),
      Animated.timing(rail, {
        toValue: 1,
        duration: motion.duration.slow,
        delay: delay + 120,
        easing: motion.easing.expoOut,
        useNativeDriver: false,
      }),
      Animated.spring(points, {
        toValue: 1,
        delay: delay + 200,
        ...motion.springBounce,
      }),
    ]).start();
  }, [delay, fade, points, rail, slide]);

  const railHeight = rail.interpolate({ inputRange: [0, 1], outputRange: [0, 72] });
  const pointsScale = points.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  const pressIn = () => Animated.spring(scale, { toValue: 0.985, ...motion.springSoft }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, ...motion.spring }).start();

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <View style={styles.row}>
        <View style={styles.rail}>
          <View style={styles.dotOuter}>
            <View style={styles.dot} />
          </View>
          {!isLast ? (
            <Animated.View style={[styles.line, { height: railHeight }]} />
          ) : null}
        </View>

        <Pressable
          onPressIn={pressIn}
          onPressOut={pressOut}
          onPress={() => Haptics.selectionAsync().catch(() => {})}
          style={{ flex: 1 }}
          accessibilityRole="button"
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <GlassSurface padding={spacing.lg} style={{ marginBottom: spacing.sm }}>
              <View style={styles.cardRow}>
                <AppIcon name="training" size={40} tone="green" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{session.className}</Text>
                  <Text style={styles.meta}>
                    {session.date} · {session.coach}
                  </Text>
                  <Text style={styles.discipline}>
                    {session.discipline} · {session.durationMin} min
                  </Text>
                </View>
                <Animated.View style={[styles.points, { transform: [{ scale: pointsScale }] }]}>
                  <AnimatedNumber
                    value={session.pointsEarned}
                    duration={motion.duration.slow}
                    formatter={(n) => `+${Math.round(n)}`}
                    style={styles.pointsVal}
                  />
                  <Text style={styles.pointsLbl}>pts</Text>
                </Animated.View>
              </View>
            </GlassSurface>
          </Animated.View>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 16, alignItems: 'center' },
  dotOuter: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.redGlass,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.red,
  },
  line: {
    width: 2,
    backgroundColor: palette.greenLine,
    marginTop: 4,
    borderRadius: 1,
    overflow: 'hidden',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { fontFamily: fonts.semi, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  discipline: { fontFamily: fonts.medium, fontSize: 11, color: colors.textFaint, marginTop: 2 },
  points: {
    alignItems: 'center',
    backgroundColor: palette.goldGlass,
    borderWidth: 1,
    borderColor: 'rgba(168,132,47,0.3)',
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 52,
  },
  pointsVal: { fontFamily: fonts.displayBold, fontSize: 16, color: palette.goldDeep },
  pointsLbl: { fontFamily: fonts.medium, fontSize: 10, color: colors.textFaint },
});
