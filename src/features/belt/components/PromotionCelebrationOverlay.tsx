import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useUnseenPromotion, useMarkPromotionCelebrationSeen } from '../hooks/useBeltPath';
import { useTheme } from '@/shared/theme';
import { duration, easingCurves } from '@/shared/theme/animations';
import { triggerSuccessNotification } from '@/shared/haptics';
import type { PromotionItem } from '@/types/domain';

const CONFETTI_COUNT = 20;
const CONFETTI_COLORS = ['#FFD700', '#FF4500', '#1E90FF', '#32CD32', '#FF69B4', '#8A2BE2'];

type ConfettiLayout = {
  startX: number;
  scale: number;
  fallDuration: number;
  spinDuration: number;
  spinDirection: number;
  delay: number;
};

function createConfettiLayout(screenWidth: number): ConfettiLayout[] {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    startX: Math.random() * screenWidth,
    scale: Math.random() * 0.6 + 0.6,
    fallDuration: Math.random() * 2000 + 2000,
    spinDuration: Math.random() * 1500 + 1000,
    spinDirection: Math.random() > 0.5 ? 1 : -1,
    delay: Math.random() * 1500,
  }));
}

interface ConfettiPieceProps {
  index: number;
  layout: ConfettiLayout;
  screenHeight: number;
}

function ConfettiPiece({ index, layout, screenHeight }: ConfettiPieceProps) {
  const y = useSharedValue(-50);
  const x = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];

  useEffect(() => {
    x.value = layout.startX;
    scale.value = layout.scale;

    y.value = withDelay(
      layout.delay,
      withRepeat(
        withTiming(screenHeight + 50, {
          duration: layout.fallDuration,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );

    rotation.value = withDelay(
      layout.delay,
      withRepeat(
        withTiming(360 * layout.spinDirection, {
          duration: layout.spinDuration,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );
  }, [layout, rotation, scale, screenHeight, x, y]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: y.value },
      { translateX: x.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
    backgroundColor: color,
  }));

  return <Animated.View style={[styles.confetti, animatedStyle]} />;
}

const ENTRANCE = {
  duration: duration.fast,
  easing: easingCurves.decelerate,
};

const EXIT = {
  duration: duration.instant,
  easing: easingCurves.standard,
};

export function PromotionCelebrationOverlay() {
  const { colors, typography, radius, inset, gap, layout, surfaceShadow } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { data: promotion, isLoading } = useUnseenPromotion();
  const { mutate: markSeen } = useMarkPromotionCelebrationSeen();
  const [activePromotion, setActivePromotion] = useState<PromotionItem | null>(null);

  const confettiLayouts = useMemo(
    () => (activePromotion ? createConfettiLayout(screenWidth) : []),
    [activePromotion, screenWidth],
  );

  const scaleVal = useSharedValue(0.96);
  const opacityVal = useSharedValue(0);

  useEffect(() => {
    if (!promotion || activePromotion) return;

    setActivePromotion(promotion);
    triggerSuccessNotification();
    scaleVal.value = 0.96;
    opacityVal.value = 0;
    scaleVal.value = withTiming(1, ENTRANCE);
    opacityVal.value = withTiming(1, ENTRANCE);
  }, [activePromotion, opacityVal, promotion, scaleVal]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleVal.value }],
    opacity: opacityVal.value,
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacityVal.value,
  }));

  if (isLoading || !activePromotion) return null;

  const isWrestling = activePromotion.discipline === 'wrestling';
  const toStripe = activePromotion.toStripe ?? 0;

  const handleDismiss = () => {
    markSeen(activePromotion.id);

    scaleVal.value = withTiming(0.98, EXIT);
    opacityVal.value = withTiming(0, EXIT, (finished) => {
      if (finished) {
        runOnJS(setActivePromotion)(null);
      }
    });
  };

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backgroundAnimatedStyle]} />

        {confettiLayouts.map((layout, index) => (
          <ConfettiPiece
            key={`${activePromotion.id}-${index}`}
            index={index}
            layout={layout}
            screenHeight={screenHeight}
          />
        ))}

        <Animated.View
          style={[
            styles.card,
            surfaceShadow('card'),
            cardAnimatedStyle,
            {
              backgroundColor: colors.surface.primary,
              borderColor: colors.border.subtle,
              borderWidth: layout.borderWidth,
              borderRadius: radius.modal,
              padding: inset.xl,
              gap: gap.lg,
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <View style={[styles.glowRing, { borderColor: colors.accent.default + '33' }]} />
            <View style={[styles.iconWrapper, { backgroundColor: colors.accent.default + '1a' }]}>
              <Ionicons name="trophy" size={48} color={colors.accent.default} />
            </View>
          </View>

          <View style={[styles.textContainer, { gap: gap.xs }]}>
            <Text
              style={[
                typography.textPresets.heading,
                { color: colors.text.primary, textAlign: 'center' },
              ]}
            >
              Rank Promotion!
            </Text>
            <Text
              style={[
                typography.textPresets.body,
                { color: colors.text.secondary, textAlign: 'center', paddingHorizontal: 16 },
              ]}
            >
              Your dedication and hard work has earned you a new rank in{' '}
              <Text style={{ color: colors.text.primary, fontWeight: '700' }}>
                {isWrestling ? 'Wrestling' : 'BJJ'}
              </Text>
              .
            </Text>
          </View>

          <View
            style={[
              styles.rankDisplay,
              {
                backgroundColor: colors.fill.secondary,
                borderRadius: radius.card,
                padding: inset.lg,
                gap: gap.sm,
              },
            ]}
          >
            {isWrestling ? (
              <View style={styles.wrestlingBadge}>
                <Text style={[typography.textPresets.subtitle, { color: colors.accent.default }]}>
                  {activePromotion.toRankName}
                </Text>
                {toStripe > 0 && (
                  <Text
                    style={[typography.textPresets.bodyStrong, { color: colors.text.secondary }]}
                  >
                    {toStripe} Stripe{toStripe > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.bjjBeltContainer}>
                <View
                  style={[
                    styles.beltBar,
                    {
                      backgroundColor:
                        activePromotion.toRankName?.toLowerCase() === 'blue'
                          ? '#1E90FF'
                          : activePromotion.toRankName?.toLowerCase() === 'purple'
                            ? '#800080'
                            : activePromotion.toRankName?.toLowerCase() === 'brown'
                              ? '#8B4513'
                              : activePromotion.toRankName?.toLowerCase() === 'black'
                                ? '#000000'
                                : '#FFFFFF',
                      borderColor: '#000000',
                      borderWidth: 1,
                      borderRadius: radius.tag,
                    },
                  ]}
                >
                  <View style={styles.beltRankBar}>
                    {Array.from({ length: toStripe }).map((_, i) => (
                      <View key={i} style={styles.beltStripe} />
                    ))}
                  </View>
                </View>
                <Text
                  style={[
                    typography.textPresets.bodyStrong,
                    { color: colors.text.primary, marginTop: 4 },
                  ]}
                >
                  {activePromotion.toRankName} Belt{' '}
                  {toStripe > 0 ? `(${toStripe} Stripe${toStripe > 1 ? 's' : ''})` : ''}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleDismiss}
            style={[
              styles.button,
              {
                backgroundColor: colors.accent.default,
                borderRadius: radius.pill,
                paddingVertical: 14,
              },
            ]}
          >
            <Text style={[typography.textPresets.bodyStrong, { color: '#FFFFFF' }]}>Let's Go!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  card: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
    }),
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 110,
    width: 110,
  },
  glowRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 55,
    borderWidth: 2,
    transform: [{ scale: 1.15 }],
  },
  iconWrapper: {
    alignItems: 'center',
    borderRadius: 50,
    height: 100,
    justifyContent: 'center',
    width: 100,
  },
  textContainer: {
    alignItems: 'center',
  },
  rankDisplay: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  wrestlingBadge: {
    alignItems: 'center',
  },
  bjjBeltContainer: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  beltBar: {
    height: 32,
    width: '80%',
    position: 'relative',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  beltRankBar: {
    backgroundColor: '#000000',
    width: 60,
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
  },
  beltStripe: {
    backgroundColor: '#FFFFFF',
    width: 4,
    height: '70%',
  },
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: 0,
  },
});
