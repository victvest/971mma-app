import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Opaque cover that hides tab content while the screen is blurred (`freezeOnBlur`).
 *
 * On blur the cover snaps to fully opaque so the frozen snapshot is a solid surface,
 * not the previous entrance end-state. On the next focus, `entranceSignal` bumps on the UI
 * thread and the cover drops — one clean entrance, no double-flash.
 */
export function useTabEntranceCover(entranceSignal: SharedValue<number>) {
  const coverOpacity = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      // Always drop the cover when focused
      requestAnimationFrame(() => {
        coverOpacity.value = 0;
      });

      return () => {
        coverOpacity.value = 1;
      };
    }, [coverOpacity]),
  );

  useAnimatedReaction(
    () => entranceSignal.value,
    (current, previous) => {
      if (previous !== null && current !== previous) {
        coverOpacity.value = 0;
      }
    },
    [entranceSignal],
  );

  const coverStyle = useAnimatedStyle(() => ({
    opacity: coverOpacity.value,
  }));

  return coverStyle;
}
