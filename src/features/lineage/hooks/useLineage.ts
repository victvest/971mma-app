import { useQuery } from '@tanstack/react-query';
import { getLineageEntries } from '@/services/database/lineage.repository';

export const lineageKey = ['lineage'] as const;

export function useLineage() {
  return useQuery({
    queryKey: lineageKey,
    queryFn: getLineageEntries,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
  });
}

export function useLineageTeaser() {
  const query = useLineage();
  const teaser = (query.data ?? []).slice(0, 2);
  return { ...query, teaser };
}
