import { useCallback, useEffect, useState } from 'react';
import { getUpcomingClasses } from '../services/db';
import { toDisplayClass } from '../data/classPresentation';
import { weekClasses as mockWeekClasses, GymClass } from '../data/mockData';

type State = {
  classes: GymClass[];
  loading: boolean;
  usingMock: boolean;
  error: string | null;
};

/** Schedule data only — no booking (members walk in). */
export function useClasses() {
  const [state, setState] = useState<State>({
    classes: [],
    loading: true,
    usingMock: false,
    error: null,
  });

  const load = useCallback(async () => {
    try {
      const items = await getUpcomingClasses();

      if (!items.length) {
        setState((s) => ({ ...s, classes: mockWeekClasses, loading: false, usingMock: true, error: null }));
        return;
      }

      const display = items.map((it) => toDisplayClass(it, false));
      setState((s) => ({ ...s, classes: display, loading: false, usingMock: false, error: null }));
    } catch (e: any) {
      setState((s) => ({
        ...s,
        classes: mockWeekClasses,
        loading: false,
        usingMock: true,
        error: e?.message ?? 'Failed to load classes',
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refresh: load };
}
