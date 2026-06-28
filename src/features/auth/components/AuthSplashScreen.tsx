import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { router } from 'expo-router';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { authRoutes } from '@/features/auth/navigation/authNavigation';
import authSplashVideo from '../../../../assets/videos/7eeef479-17fb-4f62-8f5b-0d2b93ccc651.mp4';

const SPLASH_FALLBACK_MS = 5_000;
const SPLASH_VIDEO_ASPECT_RATIO = 720 / 1280;
/** Logo/video frame at 60% of full width, centered on black. */
const SPLASH_VIDEO_SCALE = 0.6;

export function AuthSplashScreen() {
  const hasContinuedRef = useRef(false);

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
    <View style={styles.root}>
      <AppStatusBar hidden />
      <View
        pointerEvents="none"
        style={[styles.videoStage, { width: `${SPLASH_VIDEO_SCALE * 100}%`, aspectRatio: SPLASH_VIDEO_ASPECT_RATIO }]}
      >
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
    backgroundColor: '#000000',
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
