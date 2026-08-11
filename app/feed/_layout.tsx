import { Stack } from 'expo-router';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { useTheme } from '@/shared/theme';

export default function FeedLayout() {
  const { colors } = useTheme();
  const pushOptions = createStackScreenOptions(colors.background.primary, 'push');

  return (
    <Stack screenOptions={{ ...pushOptions, headerShown: false }}>
      <Stack.Screen name="new" options={pushOptions} />
      <Stack.Screen name="search" options={pushOptions} />
      <Stack.Screen name="post/[postId]" options={pushOptions} />
      <Stack.Screen name="user/[userId]" options={pushOptions} />
    </Stack>
  );
}
