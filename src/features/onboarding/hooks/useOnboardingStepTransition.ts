import { useCallback, useRef } from 'react';
import {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/theme';

export function useOnboardingStepTransition() {
  const { animations } = useTheme();
  const directionRef = useRef<1 | -1>(1);

  const goForward = useCallback(() => {
    directionRef.current = 1;
  }, []);

  const goBackward = useCallback(() => {
    directionRef.current = -1;
  }, []);

  const getStepAnimation = useCallback(() => {
    const entering = FadeIn.duration(animations.duration.slow);
    const exiting = FadeOut.duration(animations.duration.base);

    return { entering, exiting };
  }, [animations.duration.base, animations.duration.slow]);

  return { goForward, goBackward, getStepAnimation };
}
