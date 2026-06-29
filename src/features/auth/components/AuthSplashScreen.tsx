import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router } from 'expo-router';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { authRoutes } from '@/features/auth/navigation/authNavigation';
import { useTheme } from '@/shared/theme';
import authSplashVideo from '../../../../assets/videos/logo.mov';

const SPLASH_FALLBACK_MS = 5_000;
const SPLASH_VIDEO_ASPECT_RATIO = 574 / 502;
const SPLASH_VIDEO_SCALE = 0.6;
const SPLASH_VIDEO_MAX_WIDTH = 320;

export function AuthSplashScreen() {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const hasContinuedRef = useRef(false);

  const videoStageSize = useMemo(() => {
    const width = Math.min(
      SPLASH_VIDEO_MAX_WIDTH,
      Math.round(screenWidth * SPLASH_VIDEO_SCALE),
    );
    return { width, height: Math.round(width / SPLASH_VIDEO_ASPECT_RATIO) };
  }, [screenWidth]);

  const continueToIntro = useCallback(() => {
    if (hasContinuedRef.current) return;
    hasContinuedRef.current = true;
    router.replace(authRoutes.intro);
  }, []);

  const player = useVideoPlayer(authSplashVideo, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.muted = true;
    videoPlayer.play();
  });

  useEventListener(player, 'playToEnd', continueToIntro);

  useEventListener(player, 'statusChange', ({ status, error }) => {
    if (status === 'error') {
      console.warn('[AuthSplashScreen] Video playback failed', error);
      continueToIntro();
    }
  });

  useEffect(() => {
    const timeout = setTimeout(continueToIntro, SPLASH_FALLBACK_MS);
    return () => clearTimeout(timeout);
  }, [continueToIntro]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background.primary }]}>
      <AppStatusBar style="dark" backgroundColor={colors.background.primary} />
      <View pointerEvents="none" style={[styles.videoStage, videoStageSize]}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          fullscreenOptions={{ enable: false }}
          allowsPictureInPicture={false}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Skip splash video"
        onPress={continueToIntro}
        style={styles.skipTarget}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  skipTarget: {
    ...StyleSheet.absoluteFill,
  },
  video: {
    flex: 1,
  },
  videoStage: {
    overflow: 'hidden',
  },
});
