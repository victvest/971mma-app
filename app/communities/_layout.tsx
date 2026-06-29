import { Stack } from 'expo-router';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { useTheme } from '@/shared/theme';

export default function CommunitiesLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={createStackScreenOptions(colors.background.primary, 'push')}>
      <Stack.Screen name="index" options={{ title: 'Communities' }} />
      <Stack.Screen name="[id]" options={{ title: 'Group' }} />
      <Stack.Screen name="post/[postId]" options={{ title: 'Thread' }} />
    </Stack>
  );
}
