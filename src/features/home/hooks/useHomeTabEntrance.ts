import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';

export type HomeTabEntrance = {
  /** UI-thread signal — increments on tab refocus; never triggers a React re-render. */
  entranceSignal: SharedValue<number>;
  coverStyle: ReturnType<typeof useAnimatedStyle>;
};

/**
 * Home tab entrance orchestration without React state.
 *
 * On blur, an opaque cover hides the frozen `freezeOnBlur` snapshot. On refocus the
 * cover stays up for one frame, then `entranceSignal` bumps and the cover drops —
 * all on the UI thread so the tab switch frame is not blocked by a full Home re-render.
 */
export function useHomeTabEntrance(): HomeTabEntrance {
  const entranceSignal = useSharedValue(0);
  const coverOpacity = useSharedValue(0);
  const pendingReplayRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (pendingReplayRef.current) {
        pendingReplayRef.current = false;
        requestAnimationFrame(() => {
          entranceSignal.value += 1;
          coverOpacity.value = 0;
        });
      }

      return () => {
        pendingReplayRef.current = true;
        coverOpacity.value = 1;
      };
    }, [coverOpacity, entranceSignal]),
  );

  const coverStyle = useAnimatedStyle(() => ({
    opacity: coverOpacity.value,
  }));

  return { entranceSignal, coverStyle };
}
