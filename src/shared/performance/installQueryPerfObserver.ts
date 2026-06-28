import type { QueryClient } from '@tanstack/react-query';
import { isPerfInstrumentationEnabled, perfMarkOnce, recordPerfQueryFetch } from './perfMarks';
import { PerfMark } from './perfScenarios';

export function installQueryPerfObserver(queryClient: QueryClient): void {
  if (!isPerfInstrumentationEnabled()) return;

  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') return;
    if (event.action.type !== 'fetch') return;

    recordPerfQueryFetch(event.query.queryKey, event.query.state.fetchStatus);

    if (event.query.state.status === 'success') {
      perfMarkOnce(PerfMark.queryFirstSuccess, {
        queryKey: JSON.stringify(event.query.queryKey),
      });
    }
  });
}
