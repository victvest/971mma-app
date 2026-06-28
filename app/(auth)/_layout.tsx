import { Stack } from 'expo-router';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { useTheme } from '@/shared/theme';

function AuthStack() {
  const { colors } = useTheme();

  return <Stack screenOptions={createStackScreenOptions(colors.background.primary, 'push')} />;
}

export default function AuthLayout() {
  return <AuthStack />;
}
