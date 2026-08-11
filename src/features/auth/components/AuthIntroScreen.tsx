import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  openAuthLoginFromIntro,
  openAuthRegisterFromIntro,
} from '@/features/auth/navigation/authNavigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
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

// ─── Video clip constants ────────────────────────────────────────────────────
const INTRO_VIDEO_START_SEC = 7;
const INTRO_VIDEO_END_SEC = 20;
const INTRO_VIDEO_CLIP_DURATION = INTRO_VIDEO_END_SEC - INTRO_VIDEO_START_SEC;
const INTRO_VIDEO_TARGET_VOLUME = 0.92;

// ─── Layout constants ────────────────────────────────────────────────────────
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
  androidSheetBg: 'rgba(12, 12, 12, 0.72)',
} as const;

// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Wraps any player mutation in a try/catch because the native shared object
 * may already be released during unmount — especially on Android.
 */
function safePlayerAction(
  player: VideoPlayer,
  action: (p: VideoPlayer) => void,
) {
  try {
    action(player);
  } catch {
    // Native shared object may already be released during unmount.
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type IntroActionButtonProps = {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'outline' | 'ghost';
  testID?: string;
};

type IntroGlassSheetProps = {
  borderRadius: number;
  contentStyle: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

// ─── Glass sheet sub-components ──────────────────────────────────────────────

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

/**
 * Bottom sheet glass.
 *
 * iOS: native GlassView (clear) → falls back to BlurView.
 * Android: plain View with a semi-opaque dark background.
 *
 * IMPORTANT — why we avoid BlurView on Android here:
 * expo-blur's Android implementation intercepts hardware acceleration layers
 * to snapshot the content behind it. When that content is a VideoView rendered
 * via TextureView, the snapshot interferes with the video surface pipeline and
 * causes the video to freeze (frames stop being pushed to the display). This
 * is a well-known limitation documented by the expo-blur team. On Android we
 * therefore fall back to a solid-ish overlay which achieves an equivalent
 * visual result without touching the video pipeline.
 */
function IntroGlassSheet({ borderRadius, contentStyle, children }: IntroGlassSheetProps) {
  const shellStyle = [
    styles.glassShell,
    {
      borderRadius,
      borderColor: INTRO_PALETTE.glassBorder,
    },
  ];

  // ── iOS: native glass (GlassView → BlurView) ──────────────────────────────
  if (Platform.OS === 'ios') {
    if (isGlassEffectAPIAvailable()) {
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
        intensity={78}
        tint="dark"
        style={[shellStyle, { backgroundColor: 'rgba(255, 255, 255, 0.06)' }]}
      >
        <IntroGlassDim />
        <IntroGlassSpecular borderRadius={borderRadius} />
        <View style={[styles.glassContent, contentStyle]}>{children}</View>
      </BlurView>
    );
  }

  // ── Android: plain opaque overlay — no BlurView ───────────────────────────
  return (
    <View
      style={[
        shellStyle,
        { backgroundColor: INTRO_PALETTE.androidSheetBg },
      ]}
    >
      <IntroGlassDim />
      <IntroGlassSpecular borderRadius={borderRadius} />
      <View style={[styles.glassContent, contentStyle]}>{children}</View>
    </View>
  );
}

// ─── Video hook ──────────────────────────────────────────────────────────────

/**
 * Manages the intro background video player for both iOS and Android.
 *
 * Design decisions per platform:
 *
 * iOS (AVPlayer):
 *   - Seeks are fast and non-disruptive, so we use a JS-driven clip loop
 *     (seek back to INTRO_VIDEO_START_SEC at the end of the clip).
 *   - Volume is ramped up from 0 → INTRO_VIDEO_TARGET_VOLUME over the clip.
 *   - timeUpdateEventInterval drives the ramp + loop detection.
 *
 * Android (ExoPlayer via TextureView):
 *   - Every `currentTime =` assignment flushes the decoder + triggers a
 *     re-buffer, causing a visible freeze. So we avoid ALL JS-driven seeks
 *     after initial playback starts.
 *   - We set `loop = true` so ExoPlayer loops in native C++ with no JS
 *     involvement — silky smooth.
 *   - A SINGLE seek (currentTime = INTRO_VIDEO_START_SEC) happens once in
 *     statusChange → readyToPlay, guarded by an isSeeking ref so it only
 *     fires once.
 *   - Volume is set immediately to INTRO_VIDEO_TARGET_VOLUME in readyToPlay
 *     (no ramp needed — the seek to 7s means we're mid-action anyway).
 *   - We never set `muted = true` on Android because unmuting mid-stream on
 *     ExoPlayer is unreliable; it's cleaner to start unmuted at volume 0
 *     and transition to the target volume in readyToPlay.
 */
function useIntroBackgroundVideo() {
  // Prevents re-entrant seeks. On Android, concurrent seek calls can deadlock
  // the ExoPlayer state machine, causing a permanent black-screen freeze.
  const isSeekingRef = useRef(false);

  // Tracks whether readyToPlay has already been handled. statusChange can fire
  // readyToPlay more than once (e.g., after a seek completes) — we only want
  // to configure playback once.
  const hasStartedRef = useRef(false);

  const player = useVideoPlayer(introBackgroundVideo, (p) => {
    // Start silent on both platforms. Volume is raised once the player is
    // ready (statusChange → readyToPlay). We never start with muted=true on
    // Android because toggling muted mid-stream is unreliable on ExoPlayer.
    p.volume = 0;
    p.muted = false; // Keep audio codec active so enabling volume works later

    if (Platform.OS === 'android') {
      // Native looping — ExoPlayer handles this in C++, zero JS involvement,
      // no decoder stalls.
      p.loop = true;
      // Do NOT seek or play here — ExoPlayer is not ready yet and calling
      // currentTime before readyToPlay causes a freeze on some devices.
    } else {
      // iOS: seek to clip start and begin playback immediately.
      p.loop = false;
      p.timeUpdateEventInterval = 0.2;
      p.currentTime = INTRO_VIDEO_START_SEC;
      p.play();
    }
  });

  // ── readyToPlay → initial seek + start ──────────────────────────────────
  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'error') {
      console.warn('[AuthIntroScreen] Video error:', error);
      return;
    }

    if (status !== 'readyToPlay') return;
    if (hasStartedRef.current) return; // Only configure once
    hasStartedRef.current = true;

    if (Platform.OS === 'android') {
      // Guard: skip if a seek is already in flight (shouldn't happen on first
      // readyToPlay, but be defensive).
      if (isSeekingRef.current) return;

      safePlayerAction(player, (p) => {
        isSeekingRef.current = true;
        // Single authoritative seek to clip start. After this we rely on
        // native looping — no more JS seeks on Android.
        p.currentTime = INTRO_VIDEO_START_SEC;
        p.volume = INTRO_VIDEO_TARGET_VOLUME;
        p.play();

        // Release the seek guard after the decoder has settled.
        // 500ms is generous — ExoPlayer typically re-stabilises in < 200ms.
        setTimeout(() => {
          isSeekingRef.current = false;
        }, 500);
      });
    }
    // iOS: already seeking + playing from the initializer callback.
  });

  // ── iOS only: volume ramp + clip-end loop ────────────────────────────────
  //
  // On Android we deliberately skip timeUpdate — there is no periodic
  // polling, no volume ramping (it's set once in readyToPlay), and no
  // JS-driven seeks. This is the single biggest source of ExoPlayer freezes.
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (Platform.OS === 'android') return;

    // Near end of clip → loop back. Guard with isSeekingRef to prevent
    // stacking seeks if timeUpdate fires faster than the seek completes.
    if (currentTime >= INTRO_VIDEO_END_SEC - 0.08) {
      if (isSeekingRef.current) return;
      safePlayerAction(player, (p) => {
        isSeekingRef.current = true;
        p.currentTime = INTRO_VIDEO_START_SEC;
        p.volume = 0;
        setTimeout(() => {
          isSeekingRef.current = false;
        }, 300);
      });
      return;
    }

    // Volume ramp: 0 → target over the clip duration.
    if (currentTime < INTRO_VIDEO_START_SEC) return;
    const progress = Math.min(
      1,
      Math.max(0, (currentTime - INTRO_VIDEO_START_SEC) / INTRO_VIDEO_CLIP_DURATION),
    );
    safePlayerAction(player, (p) => {
      p.volume = progress * INTRO_VIDEO_TARGET_VOLUME;
    });
  });

  // ── iOS only: explicit playToEnd handler ─────────────────────────────────
  useEventListener(player, 'playToEnd', () => {
    if (Platform.OS === 'android') return; // loop=true handles this natively
    if (isSeekingRef.current) return;

    safePlayerAction(player, (p) => {
      isSeekingRef.current = true;
      p.currentTime = INTRO_VIDEO_START_SEC;
      p.volume = 0;
      p.play();
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 300);
    });
  });

  return { player, isSeekingRef };
}

// ─── Action button ───────────────────────────────────────────────────────────

function IntroActionButton({ label, onPress, variant, testID }: IntroActionButtonProps) {
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
      testID={testID}
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

// ─── Main screen ─────────────────────────────────────────────────────────────

export function AuthIntroScreen() {
  const safeInsets = useSafeAreaInsets();
  const { typography, inset, gap, animations, radius } = useTheme();
  const { player, isSeekingRef } = useIntroBackgroundVideo();
  const router = useRouter();
  const loginAsGuest = useAuthStore((s) => s.loginAsGuest);

  const copyStyle = useAuthEntranceAnimation();
  const getStartedStyle = useAuthSlideUpAnimation({ delay: animations.duration.base });
  const signInStyle = useAuthSlideUpAnimation({
    delay: animations.duration.base + animations.stagger.base,
  });
  const exploreStyle = useAuthSlideUpAnimation({
    delay: animations.duration.base + animations.stagger.base * 2,
  });

  const handleExploreApp = useCallback(() => {
    triggerLightImpact();
    loginAsGuest();
    router.replace('/(tabs)');
  }, [loginAsGuest, router]);

  // Tracks whether the screen is about to unmount (navigating away by user
  // action). In that case we skip the blur-cleanup in useFocusEffect so we
  // don't fight the navigation transition.
  const isLeavingRef = useRef(false);

  // ── Focus / blur lifecycle ─────────────────────────────────────────────
  //
  // useFocusEffect fires BEFORE the screen is fully rendered. On Android,
  // calling play() here races with statusChange → readyToPlay, causing
  // ExoPlayer to receive two simultaneous play() calls which can deadlock.
  //
  // Solution: only resume (not start) playback on focus, and only when the
  // player is already in a playable state (status === 'readyToPlay').
  // The initial play() is always driven by statusChange → readyToPlay.
  useFocusEffect(
    useCallback(() => {
      // Resume if the player was paused by a previous blur (e.g., user
      // navigated to login then came back). Do not call play() if the player
      // is still loading — statusChange will handle that.
      safePlayerAction(player, (p) => {
        if (p.status === 'readyToPlay' && !p.playing) {
          p.play();
        }
      });

      return () => {
        if (isLeavingRef.current) return;

        // Pause + silence when navigating away to conserve resources.
        safePlayerAction(player, (p) => {
          p.pause();
          p.volume = 0;
        });
      };
    }, [player]),
  );

  useEffect(() => {
    return () => {
      isLeavingRef.current = false;
    };
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: INTRO_PALETTE.canvas }]}>
      <AppStatusBar style="light" backgroundColor="transparent" translucent />

      {/*
       * VideoView — full bleed background.
       *
       * surfaceType="textureView" on Android:
       *   TextureView renders into the same hardware layer as the rest of the
       *   View hierarchy, which allows Views to sit on top of it correctly
       *   (LinearGradient, the glass sheet, etc.). The default SurfaceView
       *   renders into its own layer below the window, which can clip behind
       *   other components and cause z-ordering artifacts on some devices.
       *
       * We do NOT use BlurView on Android anywhere in this screen — see the
       * IntroGlassSheet comment for the full explanation.
       */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        allowsPictureInPicture={false}
        {...(Platform.OS === 'android' ? { surfaceType: 'textureView' as const } : {})}
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
                { color: INTRO_PALETTE.accentGreen },
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
              Earn your <Text style={{ color: INTRO_PALETTE.accentGreen }}>level.</Text>
            </Text>

            <Text
              style={[
                typography.textPresets.bodyMedium,
                styles.body,
                { color: INTRO_PALETTE.body },
              ]}
            >
              Train BJJ, wrestling, Muay Thai, boxing, and MMA. Check in, track progress, unlock
              rewards.
            </Text>
          </AnimatedView>

          <View style={[styles.actions, { gap: gap.sm }]}>
            <AnimatedView style={getStartedStyle}>
              <IntroActionButton
                label="Get Started"
                variant="primary"
                testID="auth-intro-get-started"
                onPress={openAuthRegisterFromIntro}
              />
            </AnimatedView>

            <AnimatedView style={signInStyle}>
              <IntroActionButton
                label="Sign In"
                variant="outline"
                testID="auth-intro-sign-in"
                onPress={openAuthLoginFromIntro}
              />
            </AnimatedView>

            <AnimatedView style={exploreStyle}>
              <IntroActionButton
                label="Explore the app"
                variant="ghost"
                testID="auth-intro-explore"
                onPress={handleExploreApp}
              />
            </AnimatedView>
          </View>
        </IntroGlassSheet>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

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
