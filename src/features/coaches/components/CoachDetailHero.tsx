import React, { useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import {
  getCoachDisciplineTags,
  getCoachImageSource,
  getCoachRoleLabel,
  getCoachSpecialtyLabel,
} from '@/features/coaches/components/CoachVisuals';
import { COACH_SHEET_OVERLAP } from '@/features/coaches/utils/coachDetailConstants';
import { AcademyEyebrow } from '@/shared/components/brand';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import type { CoachItem } from '@/types/domain';

type Props = {
  coach: CoachItem;
  heroHeight: number;
  scrollY: SharedValue<number>;
  fromList: boolean;
};

function HeroTag({ label, index, play }: { label: string; index: number; play: boolean }) {
  const { colors, typography, radius } = useTheme();
  const enter = useSharedValue<number>(play ? 0 : 1);

  useEffect(() => {
    enter.value = play ? 0 : 1;
    if (play) {
      enter.value = withDelay(260 + index * 90, withSpring(1, animations.spring.bouncy));
    }
  }, [enter, index, play]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: interpolate(enter.value, [0, 1], [16, 0], Extrapolation.CLAMP) },
      { scale: interpolate(enter.value, [0, 1], [0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <Animated.View
      style={[styles.tag, { backgroundColor: colors.accent.default, borderRadius: radius.pill }, style]}
    >
      <Text style={[typography.textPresets.label, { color: colors.accent.onAccent }]}>{label}</Text>
    </Animated.View>
  );
}

export function CoachDetailHero({ coach, heroHeight, scrollY, fromList }: Props) {
  const { colors, typography, inset, radius, gap } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const tags = getCoachDisciplineTags(coach);
  const hasRating = coach.rating !== null && coach.rating !== undefined;

  const entrance = useSharedValue<number>(fromList ? 0 : 1);

  useEffect(() => {
    entrance.value = fromList ? 0 : 1;
    entrance.value = withSpring(1, animations.spring.slow);
  }, [entrance, fromList, coach.id]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          [-140, 0, heroHeight],
          [-48, 0, heroHeight * 0.32],
          Extrapolation.CLAMP,
        ),
      },
      {
        scale: interpolate(scrollY.value, [-140, 0, heroHeight], [1.28, 1.08, 1.2], Extrapolation.CLAMP),
      },
    ],
  }));

  const ratingStyle = useAnimatedStyle(() => ({
    opacity:
      entrance.value *
      interpolate(scrollY.value, [0, heroHeight * 0.32, heroHeight * 0.52], [1, 0.5, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(entrance.value, [0, 1], [-12, 0], Extrapolation.CLAMP) },
      { scale: interpolate(entrance.value, [0, 1], [0.8, 1], Extrapolation.CLAMP) },
    ],
  }));

  const titleStyle = useAnimatedStyle(() => {
    const scrollFade = interpolate(
      scrollY.value,
      [0, heroHeight * 0.34, heroHeight * 0.6],
      [1, 0.66, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: entrance.value * scrollFade,
      transform: [
        {
          translateY:
            interpolate(entrance.value, [0, 1], [64, 0], Extrapolation.CLAMP) +
            interpolate(scrollY.value, [0, heroHeight * 0.6], [0, -44], Extrapolation.CLAMP),
        },
        { scale: interpolate(entrance.value, [0, 1], [0.94, 1], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <View style={[styles.wrap, { height: heroHeight }]}>
      <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
        <Image
          source={getCoachImageSource(coach)}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={0}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
        locations={[0, 0.3]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.94)']}
        locations={[0.32, 0.64, 1]}
        style={StyleSheet.absoluteFill}
      />

      {hasRating ? (
        <Animated.View
          style={[
            styles.ratingPill,
            { top: safeInsets.top + inset.sm, right: inset.lg, borderRadius: radius.pill },
            ratingStyle,
          ]}
        >
          <Ionicons name="star" size={13} color={colors.accent.onAccent} />
          <Text style={[typography.textPresets.buttonSmall, { color: colors.accent.onAccent }]}>
            {coach.rating?.toFixed(1)}
          </Text>
        </Animated.View>
      ) : null}

      <Animated.View
        style={[
          styles.titleBlock,
          { left: inset.lg, right: inset.lg, bottom: COACH_SHEET_OVERLAP + inset.md, gap: gap.sm },
          titleStyle,
        ]}
      >
        <AcademyEyebrow label="971 MMA · Dubai" accent onDark />
        {tags.length ? (
          <View style={[styles.tagRow, { gap: gap.xs }]}>
            {tags.map((tag, index) => (
              <HeroTag key={tag} label={tag} index={index} play={fromList} />
            ))}
          </View>
        ) : null}
        <Text style={[typography.textPresets.screenEyebrow, styles.role, { color: 'rgba(255,255,255,0.86)' }]}>
          {getCoachRoleLabel(coach)} · {getCoachSpecialtyLabel(coach)}
        </Text>
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          style={[typography.textPresets.coachDisplayCompact, styles.name, { color: colors.accent.onAccent }]}
        >
          {coach.name}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    width: '100%',
  },
  ratingPill: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
    zIndex: 2,
  },
  titleBlock: {
    position: 'absolute',
    zIndex: 2,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  role: {
    marginTop: 2,
  },
  name: {
    maxWidth: '100%',
  },
});
