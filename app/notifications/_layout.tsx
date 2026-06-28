import { useCallback } from 'react';
import { StatusBar } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { useTheme } from '@/shared/theme';

function NotificationsStatusBar() {
  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('dark-content', true);
    }, []),
  );

  return <AppStatusBar style="dark" translucent backgroundColor="transparent" />;
}

export default function NotificationsLayout() {
  const { colors } = useTheme();

  return (
    <>
      <NotificationsStatusBar />
      <Stack screenOptions={{ ...createStackScreenOptions(colors.background.primary, 'push'), headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="preferences" />
      </Stack>
    </>
  );
}
