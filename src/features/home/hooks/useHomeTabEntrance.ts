import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export type HomeTabEntrance = {
  /** React key used by shell-level sections for a bounded refocus visibility failsafe. */
  replayKey: number;
  /** UI-thread signal — increments on tab refocus; never triggers a React re-render. */
  entranceSignal: SharedValue<number>;
};

/**
 * Home tab entrance orchestration. The Home screen intentionally does not use a
 * full-screen blur cover: with `freezeOnBlur`, a stale native snapshot can
 * occasionally outlive the focus transition and hide the route body.
 */
export function useHomeTabEntrance(): HomeTabEntrance {
  const entranceSignal = useSharedValue(0);
  const pendingReplayRef = useRef(false);
  const [replayKey, setReplayKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (pendingReplayRef.current) {
        pendingReplayRef.current = false;
        requestAnimationFrame(() => {
          setReplayKey((current) => current + 1);
          entranceSignal.value += 1;
        });
      }

      return () => {
        pendingReplayRef.current = true;
      };
    }, [entranceSignal]),
  );

  return { entranceSignal, replayKey };
}
