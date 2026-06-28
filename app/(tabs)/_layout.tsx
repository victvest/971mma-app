import React, { useRef } from 'react';
import { View, type View as RNView } from 'react-native';
import { Stack } from 'expo-router';
import { BlurTargetView } from 'expo-blur';
import { AppTabHeader } from '@/features/home/components/AppTabHeader';
import { TabStatusBarChrome } from '@/features/home/components/navigation/TabStatusBarChrome';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { useTheme } from '@/shared/theme';

export default function TabsLayout() {
  const { colors } = useTheme();
  const blurTargetRef = useRef<RNView>(null);
  const pushOptions = createStackScreenOptions(colors.background.primary, 'push');
  const baseOptions = createStackScreenOptions(colors.background.primary, 'none');

  return (
    <View style={{ flex: 1 }}>
      <BlurTargetView ref={blurTargetRef} style={{ flex: 1 }}>
        <Stack screenOptions={baseOptions}>
          <Stack.Screen name="(main)" options={{ animation: 'none' }} />
          <Stack.Screen name="profile" options={pushOptions} />
          <Stack.Screen name="rewards" options={pushOptions} />
          <Stack.Screen name="belt-path" options={pushOptions} />
        </Stack>
        <AppTabHeader floating={true} blurTargetRef={blurTargetRef} />
      </BlurTargetView>
      <TabStatusBarChrome />
    </View>
  );
}
