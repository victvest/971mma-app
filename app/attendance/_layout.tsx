import { Stack } from 'expo-router';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import { useTheme } from '@/shared/theme';

export default function AttendanceLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={createStackScreenOptions(colors.background.primary, 'push')}>
      <Stack.Screen name="index" options={{ title: 'Attendance history' }} />
      <Stack.Screen name="class-sessions" options={{ title: 'Class attendance' }} />
    </Stack>
  );
}
