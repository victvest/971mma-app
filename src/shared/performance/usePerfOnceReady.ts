import { useEffect, useRef } from 'react';
import type { PerfMarkName } from './perfScenarios';
import { perfMarkOnce } from './perfMarks';

export function usePerfOnceReady(
  mark: PerfMarkName,
  ready: boolean,
  meta?: Record<string, unknown>,
): void {
  const firedRef = useRef(false);

  useEffect(() => {
    if (!ready || firedRef.current) return;
    firedRef.current = true;
    perfMarkOnce(mark, meta);
  }, [mark, meta, ready]);
}
