import React, { useRef } from 'react';
import { Platform, View, type View as RNView } from 'react-native';
import { Stack, useSegments } from 'expo-router';
import { BlurTargetView } from 'expo-blur';
import { CoachAppTabHeader } from '@/features/coach/components/CoachAppTabHeader';
import { useCoachScheduleFocusSync } from '@/features/coach/hooks/useCoachScheduleFocusSync';
import { TabStatusBarChrome } from '@/features/home/components/navigation/TabStatusBarChrome';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { useTheme } from '@/shared/theme';

/**
 * Android BlurTargetView snapshots its descendants for drawer blur. Nesting
 * CameraView (TextureView) under that hard-crashes the process — same class of
 * issue as VideoView + BlurView. Keep BlurTargetView on iOS only; Android uses
 * a plain View (drawer blur falls back to a solid overlay).
 */
const CoachTreeRoot = Platform.OS === 'android' ? View : BlurTargetView;

/** Tab chrome only on main coach tabs — push screens control their own status bar. */
function CoachTabStatusBarChrome() {
  const segments = useSegments();
  const isMainTabRoute = (segments as string[]).includes('(main)');

  if (!isMainTabRoute) {
    return null;
  }

  return <TabStatusBarChrome />;
}

export default function CoachLayout() {
  const { colors } = useTheme();
  const blurTargetRef = useRef<RNView>(null);
  useCoachScheduleFocusSync();
  const pushOptions = createStackScreenOptions(colors.background.primary, 'push');
  const baseOptions = createStackScreenOptions(colors.background.primary, 'none');

  return (
    <View style={{ flex: 1 }}>
      <CoachTreeRoot ref={blurTargetRef} style={{ flex: 1 }}>
        <Stack screenOptions={baseOptions}>
          <Stack.Screen name="(main)" options={{ animation: 'none' }} />
          <Stack.Screen name="run-class/[id]" options={pushOptions} />
          <Stack.Screen name="scanner" options={pushOptions} />
          <Stack.Screen name="belt-review" options={pushOptions} />
          <Stack.Screen name="curriculum" options={pushOptions} />
          <Stack.Screen name="post-announcement" options={pushOptions} />
          <Stack.Screen name="profile" options={pushOptions} />
          <Stack.Screen name="roll-call-preview" options={pushOptions} />
          <Stack.Screen
            name="roll-call/[classId]"
            options={{
              ...pushOptions,
              headerShown: false,
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="roll-call/summary/[classId]"
            options={{
              ...pushOptions,
              headerShown: false,
              gestureEnabled: true,
            }}
          />
        </Stack>
        <CoachAppTabHeader floating blurTargetRef={blurTargetRef} />
      </CoachTreeRoot>
      <CoachTabStatusBarChrome />
    </View>
  );
}
