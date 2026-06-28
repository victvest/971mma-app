import { queryClient } from '@/lib/queryClient';
import {
  mindbodyLinkKey,
  type MindbodyLinkState,
  type MindbodyLinkStatusType,
} from '../hooks/useMindbodyLink';
import { ensureMindbodyLink } from './linkMindbody';

let linkedUserId: string | null = null;
let linkingUserId: string | null = null;

export function resetMindbodyLinkOnceState(): void {
  linkedUserId = null;
  linkingUserId = null;
}

export async function runMindbodyLinkOnce(userId: string): Promise<void> {
  if (!userId) {
    resetMindbodyLinkOnceState();
    return;
  }

  if (linkedUserId === userId || linkingUserId === userId) return;

  linkingUserId = userId;
  queryClient.setQueryData<MindbodyLinkState>(mindbodyLinkKey(userId), {
    clientId: '',
    uniqueId: null,
    linkMethod: 'manual',
    linkedAt: '',
    status: 'retrying',
  });

  try {
    const result = await ensureMindbodyLink();
    if (linkingUserId !== userId) return;

    linkedUserId = userId;
    queryClient.setQueryData<MindbodyLinkState>(mindbodyLinkKey(userId), {
      clientId: result.clientId,
      uniqueId: result.uniqueId,
      linkMethod: result.linkMethod,
      linkedAt: new Date().toISOString(),
      status: 'linked',
    });
  } catch (error: unknown) {
    if (linkingUserId !== userId) return;

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
  } finally {
    if (linkingUserId === userId) {
      linkingUserId = null;
    }
  }
}
