import React from 'react';
import { Stack } from 'expo-router';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { useTheme } from '@/shared/theme';

export default function GateLayout() {
  const { colors } = useTheme();
  const baseOptions = createStackScreenOptions(colors.background.primary, 'none');

  return (
    <Stack screenOptions={{ ...baseOptions, headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="display" />
    </Stack>
  );
}
