import React from 'react';
import { StatusBar } from 'react-native';
import { useTheme } from '@/shared/theme';

type AppStatusBarStyle = 'light' | 'dark';

type AppStatusBarProps = {
  style?: AppStatusBarStyle;
  backgroundColor?: string;
  translucent?: boolean;
  hidden?: boolean;
  animated?: boolean;
};

export function AppStatusBar({
  style,
  backgroundColor,
  translucent = false,
  hidden = false,
  animated = true,
}: AppStatusBarProps) {
  const { colors, mode } = useTheme();
  const resolvedStyle = style ?? (mode === 'dark' ? 'light' : 'dark');

  return (
    <StatusBar
      animated={animated}
      hidden={hidden}
      barStyle={resolvedStyle === 'light' ? 'light-content' : 'dark-content'}
      backgroundColor={backgroundColor ?? colors.background.primary}
      translucent={translucent}
    />
  );
}
