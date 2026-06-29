import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { GlassSurface } from '@/features/home/components/navigation/GlassNavChrome';
import { authRoutes } from '@/features/auth/navigation/authNavigation';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { triggerLightImpact } from '@/shared/haptics';

interface PremiumLockOverlayProps {
  title: string;
  description: string;
  topOffset?: number;
}

export function PremiumLockOverlay({ title, description, topOffset }: PremiumLockOverlayProps) {
  const { colors, typography, radius, inset, gap } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const isAnonymous = user === null;

  const lockScale = useSharedValue(1);

  const handleAction = () => {
    triggerLightImpact();
    // Bouncing animation on lock icon when tapped
    lockScale.value = withSequence(
      withSpring(1.2, { damping: 4, stiffness: 200 }),
      withSpring(1, { damping: 10, stiffness: 100 })
    );

    if (isAnonymous) {
      logout();
      router.replace(authRoutes.intro);
      return;
    }

    router.replace('/activation-required');
  };

  const animatedLockStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lockScale.value }],
  }));

  return (
    <View style={[styles.container, { top: topOffset ?? 0 }]}>
      <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.4)' }]} />

      <View style={styles.cardWrapper}>
        <GlassSurface
          borderRadius={radius.modal}
          style={styles.glassSurface}
          contentStyle={[styles.glassContent, { padding: inset.xl, gap: gap.lg, flex: 0 }]}
        >
          <Animated.View style={[styles.iconContainer, animatedLockStyle]}>
            <View style={[styles.glowRing, { borderColor: colors.accent.default + '33' }]} />
            <View style={[styles.iconWrapper, { backgroundColor: colors.accent.default + '1a' }]}>
              <Ionicons name="lock-closed" size={36} color={colors.accent.default} />
            </View>
          </Animated.View>

          <View style={[styles.textContainer, { gap: gap.xs }]}>
            <Text style={[typography.textPresets.heading, { color: colors.text.primary, textAlign: 'center' }]}>
              {title}
            </Text>
            <Text style={[typography.textPresets.body, { color: colors.text.secondary, textAlign: 'center' }]}>
              {description}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleAction}
            style={[
              styles.button,
              {
                backgroundColor: colors.accent.default,
                borderRadius: radius.pill,
                paddingVertical: 12,
                paddingHorizontal: inset.xl,
              },
            ]}
          >
            <Text style={[typography.textPresets.button, { color: '#FFFFFF' }]}>
              {isAnonymous ? 'Sign Up to Unlock' : 'Complete Activation'}
            </Text>
          </TouchableOpacity>
        </GlassSurface>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 999,
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 320,
  },
  glassSurface: {
    width: '100%',
  },
  glassContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    width: 80,
  },
  glowRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: 40,
    borderWidth: 2,
    transform: [{ scale: 1.12 }],
  },
  iconWrapper: {
    alignItems: 'center',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  textContainer: {
    alignItems: 'center',
  },
  button: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
});
