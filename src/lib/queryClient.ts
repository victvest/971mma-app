import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { installConnectivityBridge } from '@/core/connectivity';
import { DEFAULT_QUERY_OPTIONS } from '@/lib/queryCachePolicy';
import { captureBugEvent } from '@/services/bug-reporting';
import { installQueryPerfObserver } from '@/shared/performance';

installConnectivityBridge();

function shouldReportAsyncError(error: unknown): boolean {
  return !(
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'CanceledError')
  );
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (!shouldReportAsyncError(error)) return;
      captureBugEvent({
        source: 'query_error',
        severity: 'error',
        error,
        title: 'Query failed',
        context: {
          queryHash: query.queryHash,
          queryKey: query.queryKey,
        },
      });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, variables, _context, mutation) => {
      if (!shouldReportAsyncError(error)) return;
      captureBugEvent({
        source: 'mutation_error',
        severity: 'error',
        error,
        title: 'Mutation failed',
        context: {
          mutationKey: mutation.options.mutationKey,
          variables,
        },
      });
    },
  }),
  defaultOptions: {
    queries: DEFAULT_QUERY_OPTIONS,
    mutations: {
      retry: 0,
    },
  },
});

installQueryPerfObserver(queryClient);
