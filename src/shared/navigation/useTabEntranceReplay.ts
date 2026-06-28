import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

export type TabEntrance = {
  /** React state key for header/section wrappers — triggers a small re-render. */
  replayKey: number;
  /** UI-thread signal for FlashList rows — stable `renderItem` without list recycle. */
  entranceSignal: SharedValue<number>;
};

/**
 * Replays mount entrance animations when a tab regains focus after visiting another tab.
 *
 * The replay key only bumps after a real blur (left the tab) — not on the initial mount
 * focus, which would restart entrances mid-animation.
 *
 * Pair with `useTabEntranceCover` on screens that use `freezeOnBlur`, or use
 * `useHomeTabEntrance` on Home (UI-thread signal — no React re-render on refocus).
 *
 * Use `replayKey` for headers and `entranceSignal` for FlashList row animations.
 * Do NOT pass `replayKey` through FlashList `extraData` — that forces a full recycle.
 */
export function useTabEntrance(): TabEntrance {
  const [entranceReplayKey, setEntranceReplayKey] = useState(0);
  const entranceSignal = useSharedValue(0);
  const pendingReplayRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (pendingReplayRef.current) {
        pendingReplayRef.current = false;
        setEntranceReplayKey((current) => current + 1);
        entranceSignal.value += 1;
      }

      return () => {
        pendingReplayRef.current = true;
      };
    }, [entranceSignal]),
  );

  return { replayKey: entranceReplayKey, entranceSignal };
}

/** @deprecated Prefer `useTabEntrance().replayKey` for headers only. */
export function useTabEntranceReplay(): number {
  return useTabEntrance().replayKey;
}
