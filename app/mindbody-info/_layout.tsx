import { Stack } from 'expo-router';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { useTheme } from '@/shared/theme';

export default function MindbodyInfoLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={createStackScreenOptions(colors.background.primary, 'push')}>
      <Stack.Screen name="index" options={{ title: 'Mindbody ID' }} />
    </Stack>
  );
}
