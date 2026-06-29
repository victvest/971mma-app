import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useEventListener } from 'expo';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  openAuthLoginFromIntro,
  openAuthRegisterFromIntro,
} from '@/features/auth/navigation/authNavigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';
import {
  useAuthEntranceAnimation,
  useAuthSlideUpAnimation,
} from '@/features/auth/hooks/useAuthEntranceAnimation';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { useAuthStore } from '@/stores/useAuthStore';
import { triggerLightImpact } from '@/shared/haptics';
import introBackgroundVideo from '../../../../assets/videos/video.mp4';
import introBrandMark from '../../../../assets/brand/logo-notext.png';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedView = Animated.createAnimatedComponent(View);

const INTRO_VIDEO_START_SEC = 7;
const INTRO_VIDEO_END_SEC = 20;
const INTRO_VIDEO_CLIP_DURATION = INTRO_VIDEO_END_SEC - INTRO_VIDEO_START_SEC;
const INTRO_VIDEO_TARGET_VOLUME = 0.92;
const INTRO_SHEET_OVERLAP = 32;
const INTRO_TOP_LOGO_WIDTH = 88;

/** Minimal white tint — lets the native clear glass refract video like water. */
const INTRO_GLASS_TINT = 'rgba(255, 255, 255, 0.10)';

const INTRO_PALETTE = {
  canvas: '#0C0C0C',
  flagRed: '#C8102E',
  accentGreen: '#00843D',
  headline: '#FFFFFF',
  body: 'rgba(255,255,255,0.72)',
  outlineBorder: 'rgba(255,255,255,0.32)',
  guestText: 'rgba(255,255,255,0.68)',
  glassBorder: 'rgba(255, 255, 255, 0.22)',
  glassSpecular: 'rgba(255, 255, 255, 0.38)',
  glassDim: 'rgba(0, 0, 0, 0.44)',
} as const;

type IntroActionButtonProps = {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'outline' | 'ghost';
};

type IntroGlassSheetProps = {
  borderRadius: number;
  contentStyle: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

function IntroGlassSpecular({ borderRadius }: { borderRadius: number }) {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.glassSpecular,
        {
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
          backgroundColor: INTRO_PALETTE.glassSpecular,
        },
      ]}
    />
  );
}

function IntroGlassDim() {
  return (
    <View
      pointerEvents="none"
      style={[styles.glassDim, { backgroundColor: INTRO_PALETTE.glassDim }]}
    />
  );
}

/** Bottom sheet glass — full-bleed video must sit behind this for the water refraction. */
function IntroGlassSheet({ borderRadius, contentStyle, children }: IntroGlassSheetProps) {
  const shellStyle = [
    styles.glassShell,
    {
      borderRadius,
      borderColor: INTRO_PALETTE.glassBorder,
    },
  ];

  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable()) {
    return (
      <GlassView
        glassEffectStyle="clear"
        colorScheme="dark"
        tintColor={INTRO_GLASS_TINT}
        style={shellStyle}
      >
        <IntroGlassDim />
        <IntroGlassSpecular borderRadius={borderRadius} />
        <View style={[styles.glassContent, contentStyle]}>{children}</View>
      </GlassView>
    );
  }

  return (
    <BlurView
      intensity={Platform.OS === 'ios' ? 78 : 52}
      tint="dark"
      style={[
        shellStyle,
        {
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        },
      ]}
    >
      <IntroGlassDim />
      <IntroGlassSpecular borderRadius={borderRadius} />
      <View style={[styles.glassContent, contentStyle]}>{children}</View>
    </BlurView>
  );
}

function useIntroBackgroundVideo() {
  const player = useVideoPlayer(introBackgroundVideo, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = false;
    videoPlayer.volume = 0;
    videoPlayer.timeUpdateEventInterval = 0.2;
    videoPlayer.currentTime = INTRO_VIDEO_START_SEC;
    videoPlayer.play();
  });

  const applyVolumeRamp = useCallback((currentTime: number) => {
    if (currentTime < INTRO_VIDEO_START_SEC) {
      player.volume = 0;
      return;
    }

    const progress = Math.min(
      1,
      Math.max(0, (currentTime - INTRO_VIDEO_START_SEC) / INTRO_VIDEO_CLIP_DURATION),
    );
    player.volume = progress * INTRO_VIDEO_TARGET_VOLUME;
  }, [player]);

  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'readyToPlay') {
      player.currentTime = INTRO_VIDEO_START_SEC;
      player.volume = 0;
      player.play();
    }
  });

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (currentTime >= INTRO_VIDEO_END_SEC - 0.08) {
      player.currentTime = INTRO_VIDEO_START_SEC;
      player.volume = 0;
      return;
    }

    applyVolumeRamp(currentTime);
  });

  useEventListener(player, 'playToEnd', () => {
    player.currentTime = INTRO_VIDEO_START_SEC;
    player.volume = 0;
    player.play();
  });

  return player;
}

function IntroActionButton({ label, onPress, variant }: IntroActionButtonProps) {
  const { typography, layout, radius, animations } = useTheme();
  const scale = useSharedValue<number>(animations.scale.resting);
  const isPrimary = variant === 'primary';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(animations.scale.pressed, animations.spring.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(animations.scale.resting, animations.spring.snappy);
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.introButton,
        isGhost && styles.ghostButton,
        {
          minHeight: isGhost ? layout.authButtonHeight - 8 : layout.authButtonHeight,
          borderRadius: radius.button,
          borderWidth: isOutline ? 1.5 : 0,
          backgroundColor: isPrimary ? INTRO_PALETTE.accentGreen : 'transparent',
          borderColor: isOutline ? INTRO_PALETTE.outlineBorder : 'transparent',
        },
        pressStyle,
      ]}
    >
      <Text
        style={[
          isGhost ? typography.textPresets.buttonSmall : typography.textPresets.button,
          {
            color: isPrimary
              ? INTRO_PALETTE.headline
              : isOutline
                ? INTRO_PALETTE.headline
                : INTRO_PALETTE.guestText,
          },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export function AuthIntroScreen() {
  const safeInsets = useSafeAreaInsets();
  const { typography, inset, gap, animations, radius } = useTheme();
  const player = useIntroBackgroundVideo();
  const loginAsGuest = useAuthStore((s) => s.loginAsGuest);

  const copyStyle = useAuthEntranceAnimation();
  const getStartedStyle = useAuthSlideUpAnimation({ delay: animations.duration.base });
  const loginStyle = useAuthSlideUpAnimation({
    delay: animations.duration.base + animations.stagger.base,
  });
  const guestStyle = useAuthSlideUpAnimation({
    delay: animations.duration.base + animations.stagger.base * 2,
  });

  const handleContinueAsGuest = useCallback(() => {
    triggerLightImpact();
    loginAsGuest();
  }, [loginAsGuest]);

  return (
    <View style={[styles.root, { backgroundColor: INTRO_PALETTE.canvas }]}>
      <AppStatusBar style="light" backgroundColor="transparent" translucent />

      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.12)', 'transparent']}
        locations={[0, 0.55, 1]}
        style={[styles.mediaTopScrim, { height: safeInsets.top + 72 }]}
        pointerEvents="none"
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.55)']}
        locations={[0.35, 0.72, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[styles.topMarkWrap, { paddingTop: safeInsets.top + inset.sm }]}
        pointerEvents="none"
      >
        <Image
          source={introBrandMark}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel="971 MMA"
          style={[styles.topLogo, { tintColor: INTRO_PALETTE.headline }]}
        />
      </View>

      <View style={styles.bottomAnchor} pointerEvents="box-none">
        <IntroGlassSheet
          borderRadius={radius.cardLarge}
          contentStyle={{
            paddingHorizontal: inset.lg,
            paddingTop: inset.sm,
            paddingBottom: Math.max(safeInsets.bottom, inset.sm),
            gap: gap.md,
          }}
        >
          <AnimatedView style={[styles.copyBlock, { gap: gap.sm }, copyStyle]}>
            <Text
              style={[
                typography.textPresets.academyKicker,
                styles.kicker,
                { color: INTRO_PALETTE.flagRed },
              ]}
            >
              971 MMA & Fitness Academy
            </Text>

            <Text
              style={[
                typography.textPresets.homeHero,
                styles.heroTitle,
                { color: INTRO_PALETTE.headline, lineHeight: 42 },
              ]}
            >
              Earn your{' '}
              <Text style={{ color: INTRO_PALETTE.accentGreen }}>level.</Text>
            </Text>

            <Text
              style={[
                typography.textPresets.bodyMedium,
                styles.body,
                { color: INTRO_PALETTE.body },
              ]}
            >
              Train BJJ, Muay Thai, boxing, and MMA. Check in, track progress, unlock rewards.
            </Text>
          </AnimatedView>

          <View style={[styles.actions, { gap: gap.sm }]}>
            <AnimatedView style={getStartedStyle}>
              <IntroActionButton
                label="Get Started"
                variant="primary"
                onPress={openAuthRegisterFromIntro}
              />
            </AnimatedView>

            <AnimatedView style={loginStyle}>
              <IntroActionButton
                label="Log In"
                variant="outline"
                onPress={openAuthLoginFromIntro}
              />
            </AnimatedView>

            <AnimatedView style={guestStyle}>
              <IntroActionButton
                label="Continue as a guest"
                variant="ghost"
                onPress={handleContinueAsGuest}
              />
            </AnimatedView>
          </View>
        </IntroGlassSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mediaTopScrim: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  topMarkWrap: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  topLogo: {
    height: INTRO_TOP_LOGO_WIDTH,
    width: INTRO_TOP_LOGO_WIDTH,
  },
  bottomAnchor: {
    flex: 1,
    justifyContent: 'flex-end',
    zIndex: 3,
  },
  glassShell: {
    borderWidth: 0.5,
    marginTop: -INTRO_SHEET_OVERLAP,
    overflow: 'hidden',
  },
  glassSpecular: {
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 2,
  },
  glassDim: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  glassContent: {
    position: 'relative',
    zIndex: 3,
  },
  copyBlock: {
    alignItems: 'center',
  },
  heroTitle: {
    textAlign: 'center',
  },
  kicker: {
    textAlign: 'center',
  },
  body: {
    maxWidth: 340,
    textAlign: 'center',
  },
  actions: {
    flexShrink: 0,
  },
  introButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ghostButton: {
    marginTop: 2,
  },
});
