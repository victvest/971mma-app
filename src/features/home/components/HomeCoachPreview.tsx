import React, { memo, useCallback, useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { getCoachImageSource } from '@/features/coaches/components/CoachVisuals';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { HomeCoachesScroll } from '@/features/home/components/HomeCoachesScroll';
import { HomeSectionTitle } from '@/features/home/components/HomeSectionTitle';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import type { CoachItem } from '@/types/domain';

const CARD_WIDTH = 148;

type CoachCardProps = {
  coach: CoachItem;
  index: number;
  onPress: (id: string) => void;
};

const CoachCard = memo(function CoachCard({ coach, index, onPress }: CoachCardProps) {
  const { colors, radius, typography, shadows } = useTheme();
  const handlePress = useCallback(() => onPress(coach.id), [coach.id, onPress]);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(14);

  useEffect(() => {
    const delay = index * animations.stagger.fast;
    opacity.value = withDelay(delay, withTiming(1, animations.timing.fade));
    translateY.value = withDelay(delay, withSpring(0, animations.spring.gentle));
  }, [index, opacity, translateY]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.card, entranceStyle]}>
      <HomeAnimatedPressable
        onPress={handlePress}
        accessibilityLabel={`View coach ${coach.name}`}
        scaleTo={0.97}
        style={styles.pressable}
      >
        <View
          style={[
            styles.imageFrame,
            shadows.card,
            {
              borderRadius: radius.cardLarge,
              backgroundColor: colors.surface.secondary,
            },
          ]}
        >
          <Image
            source={getCoachImageSource(coach)}
            style={[styles.image, { borderRadius: radius.cardLarge }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={coach.id}
            transition={200}
          />
        </View>

        <View style={styles.meta}>
          <Text
            style={[typography.textPresets.bodyStrong, styles.name, { color: colors.text.primary }]}
            numberOfLines={1}
          >
            {coach.name}
          </Text>
          <Text
            style={[typography.textPresets.caption, { color: colors.text.secondary }]}
            numberOfLines={1}
          >
            {coach.specialty || 'Instructor'}
          </Text>
        </View>
      </HomeAnimatedPressable>
    </Animated.View>
  );
});

type Props = {
  coaches: CoachItem[];
  onCoachPress: (id: string) => void;
  onSeeAll: () => void;
};

export const HomeCoachPreview = memo(function HomeCoachPreview({
  coaches,
  onCoachPress,
  onSeeAll,
}: Props) {
  if (coaches.length === 0) {
    return null;
  }

  return (
    <View>
      <HomeSectionTitle
        title="Coaching team"
        actionLabel="See all"
        onAction={onSeeAll}
        actionAccessibilityLabel="See all coaches"
      />
      <HomeCoachesScroll cardGap={16}>
        {coaches.map((coach, index) => (
          <CoachCard key={coach.id} coach={coach} index={index} onPress={onCoachPress} />
        ))}
      </HomeCoachesScroll>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
  },
  pressable: {
    width: '100%',
  },
  imageFrame: {
    height: 196,
    overflow: 'hidden',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  meta: {
    gap: 2,
    marginTop: 10,
    paddingHorizontal: 2,
  },
  name: {
    letterSpacing: -0.2,
  },
});
