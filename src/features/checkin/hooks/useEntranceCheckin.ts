import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  EntryCheckinNeedsConfirmation,
  EntryCheckinRequest,
  EntryCheckinSuccess,
} from '@/features/gate/types';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { invalidateAfterMemberCheckin } from '@/lib/queryInvalidation';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { useAuthStore } from '@/stores/useAuthStore';

export type EntranceCheckinOutcome =
  | { kind: 'success'; data: EntryCheckinSuccess }
  | { kind: 'needs_confirmation'; data: EntryCheckinNeedsConfirmation };

type EntryCheckinBody = EntryCheckinRequest;

export function useEntranceCheckin() {
  const authUserId = useAuthStore((s) => s.user?.id ?? '');
  const activeMemberId = useActiveMemberId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EntryCheckinBody): Promise<EntranceCheckinOutcome> => {
      const payload: EntryCheckinBody = { ...input };
      if (
        !payload.targetUserId &&
        activeMemberId &&
        activeMemberId !== authUserId
      ) {
        payload.targetUserId = activeMemberId;
      }

      const data = await invokeEdge<EntryCheckinSuccess | EntryCheckinNeedsConfirmation>(
        'entry-checkin',
        payload,
      );

      if ('needsConfirmation' in data && data.needsConfirmation) {
        return { kind: 'needs_confirmation', data };
      }

      return { kind: 'success', data: data as EntryCheckinSuccess };
    },
    onSuccess: (outcome) => {
      if (outcome.kind !== 'success') return;

      const memberId = activeMemberId || authUserId;
      invalidateAfterMemberCheckin(queryClient, memberId);
    },
  });
}
