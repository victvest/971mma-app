import { useCallback, useLayoutEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

/**
 * Opaque cover that hides tab content while the screen is blurred (`freezeOnBlur`).
 *
 * On blur the cover snaps to fully opaque so the frozen snapshot is a solid surface,
 * not the previous entrance end-state. On the next focus, `replayKey` bumps and
 * `useLayoutEffect` drops the cover in the same commit as section resets — one clean
 * entrance, no double-flash.
 */
export function useTabEntranceCover(replayKey: number) {
  const coverOpacity = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      return () => {
        coverOpacity.value = 1;
      };
    }, [coverOpacity]),
  );

  useLayoutEffect(() => {
    coverOpacity.value = 0;
  }, [coverOpacity, replayKey]);

  const coverStyle = useAnimatedStyle(() => ({
    opacity: coverOpacity.value,
  }));

  return coverStyle;
}
