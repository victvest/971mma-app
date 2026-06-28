import { Platform } from 'react-native';

import { animations } from '@/shared/theme/animations';

export type StackTransitionVariant = 'push' | 'fade' | 'none';

type StackAnimation =
  | 'default'
  | 'slide_from_right'
  | 'fade'
  | 'none';

const pushAnimation: StackAnimation = Platform.select({
  ios: 'default',
  android: 'slide_from_right',
  default: 'default',
}) ?? 'default';

export function createStackScreenOptions(
  backgroundColor: string,
  variant: StackTransitionVariant = 'push',
) {
  const animation: StackAnimation =
    variant === 'fade' ? 'fade' : variant === 'none' ? 'none' : pushAnimation;

  const animationTypeForReplace: 'push' | 'pop' = variant === 'fade' ? 'pop' : 'push';

  return {
    headerShown: false,
    contentStyle: { backgroundColor },
    animation,
    animationDuration: animations.duration.base,
    gestureEnabled: variant === 'push',
    animationTypeForReplace,
  };
}
