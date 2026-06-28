import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ensureMindbodyLink, type MindbodyLinkResult } from '../services/linkMindbody';
import { getSupabaseClient } from '@/services/supabase/client';
import type { MindbodyLinkRow } from '@/types/database';

export type MindbodyLinkStatusType =
  | 'linked'
  | 'not_linked'
  | 'ambiguous'
  | 'failed'
  | 'retrying'
  | 'support_required';

export type MindbodyLinkState = {
  clientId: string;
  uniqueId: string | null;
  linkMethod: MindbodyLinkRow['link_method'] | 'manual';
  linkedAt: string;
  status: MindbodyLinkStatusType;
  error?: string | null;
};

export const mindbodyLinkKey = (userId: string | undefined) => ['mindbody-link', userId] as const;

async function readMindbodyLink(userId: string, queryClient: QueryClient): Promise<MindbodyLinkState> {
  const { data, error } = await getSupabaseClient()
    .from('mindbody_links')
    .select('mindbody_client_id, mindbody_unique_id, link_method, linked_at')
    .eq('user_id', userId)
    .maybeSingle<
      Pick<
        MindbodyLinkRow,
        'mindbody_client_id' | 'mindbody_unique_id' | 'link_method' | 'linked_at'
      >
    >();

  if (error) throw error;

  if (!data) {
    const current = queryClient.getQueryData<MindbodyLinkState>(mindbodyLinkKey(userId));
    if (current && current.status !== 'linked' && current.status !== 'not_linked') {
      return current;
    }
    return {
      clientId: '',
      uniqueId: null,
      linkMethod: 'manual',
      linkedAt: '',
      status: 'not_linked',
    };
  }

  return {
    clientId: data.mindbody_client_id,
    uniqueId: data.mindbody_unique_id,
    linkMethod: data.link_method,
    linkedAt: data.linked_at,
    status: 'linked',
  };
}

export function useMindbodyLink(userId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: mindbodyLinkKey(userId),
    queryFn: () => readMindbodyLink(userId!, queryClient),
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
    gcTime: 48 * 60 * 60 * 1000,
    refetchOnMount: true,
  });
}

export function useEnsureMindbodyLink(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ensureMindbodyLink,
    onMutate: async () => {
      if (!userId) return;
      queryClient.setQueryData<MindbodyLinkState>(mindbodyLinkKey(userId), {
        clientId: '',
        uniqueId: null,
        linkMethod: 'manual',
        linkedAt: '',
        status: 'retrying',
      });
    },
    onSuccess: async (result: MindbodyLinkResult) => {
      if (!userId) return;
      queryClient.setQueryData<MindbodyLinkState>(mindbodyLinkKey(userId), {
        clientId: result.clientId,
        uniqueId: result.uniqueId,
        linkMethod: result.linkMethod,
        linkedAt: new Date().toISOString(),
        status: 'linked',
      });
      await queryClient.invalidateQueries({ queryKey: mindbodyLinkKey(userId) });
    },
    onError: async (error: unknown) => {
      if (!userId) return;
      const err = error as Record<string, unknown>;
      const rawCode = err.rawCode as string | undefined;
      let status: MindbodyLinkStatusType = 'failed';
      if (rawCode === 'AMBIGUOUS_MATCH') {
        status = 'ambiguous';
      } else if (rawCode === 'NOT_LINKED') {
        status = 'support_required';
      }
      queryClient.setQueryData<MindbodyLinkState>(mindbodyLinkKey(userId), {
        clientId: '',
        uniqueId: null,
        linkMethod: 'manual',
        linkedAt: '',
        status,
        error: (err.message as string) || 'Linking failed.',
      });
      await queryClient.invalidateQueries({ queryKey: mindbodyLinkKey(userId) });
    },
  });
}
