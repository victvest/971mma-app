import { useEffect, useRef } from 'react';
import type { PerfMarkName } from './perfScenarios';
import { perfMark } from './perfMarks';

export function usePerfRouteMount(mark: PerfMarkName, meta?: Record<string, unknown>): void {
  const metaRef = useRef(meta);
  metaRef.current = meta;

  useEffect(() => {
    perfMark(mark, metaRef.current);
  }, [mark]);
}
