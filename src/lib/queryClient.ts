import { QueryClient } from '@tanstack/react-query';
import { installConnectivityBridge } from '@/core/connectivity';
import { DEFAULT_QUERY_OPTIONS } from '@/lib/queryCachePolicy';
import { installQueryPerfObserver } from '@/shared/performance';

installConnectivityBridge();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: DEFAULT_QUERY_OPTIONS,
    mutations: {
      retry: 0,
    },
  },
});

installQueryPerfObserver(queryClient);
