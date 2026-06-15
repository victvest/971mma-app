import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, palette, radii, spacing } from '../../theme';
import { FeatureIcon } from '../icons/FeatureIcon';
import { GlassSurface } from '../GlassSurface';
import type { TrainingSession } from '../../data/memberFeatures';

type Props = {
  sessions: TrainingSession[];
};

/** Vertical session timeline with staggered entrance animations. */
export function SessionTimeline({ sessions }: Props) {
  return (
    <View style={styles.wrap}>
      {sessions.map((s, i) => (
        <SessionRow key={s.id} session={s} index={i} isLast={i === sessions.length - 1} />
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
  const slide = useRef(new Animated.Value(24)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 480,
        delay: index * 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 480,
        delay: index * 90,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, index, slide]);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      <View style={styles.row}>
        <View style={styles.rail}>
          <View style={styles.dot} />
          {!isLast ? <View style={styles.line} /> : null}
        </View>
        <GlassSurface padding={spacing.lg} style={{ flex: 1, marginBottom: spacing.sm }}>
          <View style={styles.cardRow}>
            <FeatureIcon name="training" size={44} tone="green" />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{session.className}</Text>
              <Text style={styles.meta}>
                {session.date} · {session.coach}
              </Text>
              <Text style={styles.discipline}>{session.discipline} · {session.durationMin} min</Text>
            </View>
            <View style={styles.points}>
              <Text style={styles.pointsVal}>+{session.pointsEarned}</Text>
              <Text style={styles.pointsLbl}>pts</Text>
            </View>
          </View>
        </GlassSurface>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 16, alignItems: 'center' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.green,
    borderWidth: 2,
    borderColor: palette.greenGlass,
    marginTop: 18,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: palette.greenLine,
    marginTop: 4,
    marginBottom: -8,
    borderRadius: 1,
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
  },
  pointsVal: { fontFamily: fonts.displayBold, fontSize: 16, color: palette.goldDeep },
  pointsLbl: { fontFamily: fonts.medium, fontSize: 10, color: colors.textFaint },
});
