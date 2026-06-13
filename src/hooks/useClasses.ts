import { useCallback, useEffect, useState } from 'react';
import { getUpcomingClasses, getMyBookings, bookClass, cancelBooking } from '../services/db';
import { toDisplayClass } from '../data/classPresentation';
import { weekClasses as mockWeekClasses, GymClass } from '../data/mockData';

type State = {
  classes: GymClass[];
  loading: boolean;
  usingMock: boolean;
  error: string | null;
  busyId: string | null;
};

export function useClasses() {
  const [state, setState] = useState<State>({
    classes: [],
    loading: true,
    usingMock: false,
    error: null,
    busyId: null,
  });

  const load = useCallback(async () => {
    try {
      const [items, bookings] = await Promise.all([getUpcomingClasses(), getMyBookings()]);
      const bookedIds = new Set(bookings.map((b) => b.classId));

      if (!items.length) {
        // Graceful fallback so the UI never looks empty during review.
        setState((s) => ({ ...s, classes: mockWeekClasses, loading: false, usingMock: true, error: null }));
        return;
      }

      const display = items.map((it) => toDisplayClass(it, bookedIds.has(it.id)));
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

  const setBooked = (id: string, isBooked: boolean) =>
    setState((s) => ({
      ...s,
      classes: s.classes.map((c) => (c.id === id ? { ...c, isBooked } : c)),
    }));

  const book = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, busyId: id }));
      // Optimistic; revert on failure (skip network entirely in mock mode).
      try {
        setBooked(id, true);
        if (!state.usingMock) await bookClass(id);
      } catch {
        setBooked(id, false);
      } finally {
        setState((s) => ({ ...s, busyId: null }));
      }
    },
    [state.usingMock],
  );

  const cancel = useCallback(
    async (id: string) => {
      setState((s) => ({ ...s, busyId: id }));
      try {
        setBooked(id, false);
        if (!state.usingMock) await cancelBooking(id);
      } catch {
        setBooked(id, true);
      } finally {
        setState((s) => ({ ...s, busyId: null }));
      }
    },
    [state.usingMock],
  );

  return { ...state, refresh: load, book, cancel };
}
