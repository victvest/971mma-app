import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useUnseenPromotion, useMarkPromotionCelebrationSeen } from '../hooks/useBeltPath';
import { useTheme } from '@/shared/theme';
import { triggerSuccessNotification } from '@/shared/haptics';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ConfettiPieceProps {
  index: number;
}

function ConfettiPiece({ index }: ConfettiPieceProps) {
  const y = useSharedValue(-50);
  const x = useSharedValue(Math.random() * SCREEN_WIDTH);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(Math.random() * 0.6 + 0.6);

  const colors = ['#FFD700', '#FF4500', '#1E90FF', '#32CD32', '#FF69B4', '#8A2BE2'];
  const color = colors[index % colors.length];

  useEffect(() => {
    const delay = Math.random() * 1500;
    y.value = withDelay(
      delay,
      withRepeat(
        withTiming(SCREEN_HEIGHT + 50, {
          duration: Math.random() * 2000 + 2000,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );

    rotation.value = withDelay(
      delay,
      withRepeat(
        withTiming(360 * (Math.random() > 0.5 ? 1 : -1), {
          duration: Math.random() * 1500 + 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );
  }, []);

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

export function PromotionCelebrationOverlay() {
  const { colors, typography, radius, inset, gap } = useTheme();
  const { data: promotion, isLoading } = useUnseenPromotion();
  const { mutate: markSeen } = useMarkPromotionCelebrationSeen();
  const [visible, setVisible] = useState(false);

  const scaleVal = useSharedValue(0.3);
  const opacityVal = useSharedValue(0);

  useEffect(() => {
    if (promotion) {
      setVisible(true);
      triggerSuccessNotification();
      scaleVal.value = withSpring(1, { damping: 12, stiffness: 90 });
      opacityVal.value = withTiming(1, { duration: 400 });
    } else {
      setVisible(false);
    }
  }, [promotion]);

  if (isLoading || !promotion || !visible) return null;

  const isWrestling = promotion.discipline === 'wrestling';
  const toStripe = promotion.toStripe ?? 0;

  const handleDismiss = () => {
    scaleVal.value = withTiming(0.5, { duration: 250 });
    opacityVal.value = withTiming(0, { duration: 250 }, () => {
      markSeen(promotion.id);
    });
  };

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleVal.value }],
    opacity: opacityVal.value,
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacityVal.value,
  }));

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={handleDismiss}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backgroundAnimatedStyle]} />

        {/* Confetti rain */}
        {Array.from({ length: 40 }).map((_, i) => (
          <ConfettiPiece key={i} index={i} />
        ))}

        <Animated.View
          style={[
            styles.card,
            cardAnimatedStyle,
            {
              backgroundColor: colors.surface.primary,
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
            <Text style={[typography.textPresets.heading, { color: colors.text.primary, textAlign: 'center' }]}>
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
                  {promotion.toRankName}
                </Text>
                {toStripe > 0 && (
                  <Text style={[typography.textPresets.bodyStrong, { color: colors.text.secondary }]}>
                    {toStripe} Stripe{toStripe > 1 ? 's' : ''}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.bjjBeltContainer}>
                {/* Belt graphic representation */}
                <View
                  style={[
                    styles.beltBar,
                    {
                      backgroundColor:
                        promotion.toRankName?.toLowerCase() === 'blue'
                          ? '#1E90FF'
                          : promotion.toRankName?.toLowerCase() === 'purple'
                          ? '#800080'
                          : promotion.toRankName?.toLowerCase() === 'brown'
                          ? '#8B4513'
                          : promotion.toRankName?.toLowerCase() === 'black'
                          ? '#000000'
                          : '#FFFFFF', // White belt default
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
                <Text style={[typography.textPresets.bodyStrong, { color: colors.text.primary, marginTop: 4 }]}>
                  {promotion.toRankName} Belt {toStripe > 0 ? `(${toStripe} Stripe${toStripe > 1 ? 's' : ''})` : ''}
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
            <Text style={[typography.textPresets.bodyStrong, { color: '#FFFFFF' }]}>
              Let's Go!
            </Text>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    width: '100%',
    maxWidth: 340,
    zIndex: 10,
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
