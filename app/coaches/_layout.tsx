import { Stack } from 'expo-router';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { useTheme } from '@/shared/theme';

export default function CoachesLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={createStackScreenOptions(colors.background.primary, 'push')} />
  );
}
