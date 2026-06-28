import type { QueryClient, QueryKey } from '@tanstack/react-query';

type RefetchGroupOptions = {
  /** When true, refetch even if the query is still fresh (explicit pull-to-refresh). */
  force?: boolean;
};

/**
 * Refetch only active queries in a refresh group.
 * Foreground/reconnect paths should pass force=false so fresh caches are left alone.
 */
export async function refetchQueryGroup(
  queryClient: QueryClient,
  queryKeys: readonly QueryKey[],
  options: RefetchGroupOptions = {},
): Promise<void> {
  const { force = false } = options;

  await Promise.all(
    queryKeys.map((queryKey) =>
      queryClient.refetchQueries({
        queryKey,
        type: 'active',
        ...(force ? {} : { stale: true }),
      }),
    ),
  );
}

/** Invalidate list/detail caches only when a Mindbody mirror edge call actually refreshed data. */
export function shouldInvalidateAfterMirrorSync(
  result: { refreshed?: boolean } | null | undefined,
  force = false,
): boolean {
  return force || Boolean(result?.refreshed);
}
