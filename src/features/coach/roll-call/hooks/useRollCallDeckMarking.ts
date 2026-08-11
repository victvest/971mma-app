import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  RollCallConfig,
  RollCallDeckMember,
  RollCallMarkMetadata,
  RollCallMemberMark,
  RollCallMemberStatus,
  RollCallState,
} from '@/features/coach/roll-call/types';
import { DEFAULT_ROLL_CALL_CONFIG } from '@/features/coach/roll-call/types';
import { rollCallKey } from '@/features/coach/roll-call/hooks/useRollCall';
import {
  applyOptimisticRollCallMark,
  patchRollCallDeckMark,
  swipeCommitToStatus,
} from '@/features/coach/roll-call/utils/optimisticRollCallMark';
import { buildRollCallMarkMetadata } from '@/features/coach/roll-call/utils/buildRollCallMarkMetadata';
import type { RollCallSwipeCommit } from '@/features/coach/roll-call/utils/rollCallGestures';
import { useAuthStore } from '@/stores/useAuthStore';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { toUserFacingErrorMessage } from '@/lib/userFacingError';

export type RollCallDeckMarkStatus = Extract<RollCallMemberStatus, 'present' | 'absent' | 'late'>;

export type RollCallSummaryMarkStatus = Extract<
  RollCallMemberStatus,
  'present' | 'absent' | 'late' | 'left_early'
>;

function formatMarkError(error: unknown): string {
  return toUserFacingErrorMessage(error, { fallback: 'Check your connection and try again.' });
}

/**
 * Deck + summary marking is local-only. Network flush happens on Confirm attendance.
 */
export function useRollCallDeckMarking(
  classId: string | null,
  _config: RollCallConfig = DEFAULT_ROLL_CALL_CONFIG,
) {
  const queryClient = useQueryClient();
  const { showAlert } = useDialog();
  const coachId = useAuthStore((s) => s.user?.id ?? '');

  const recordWithStatus = useCallback(
    async (
      member: RollCallDeckMember,
      status: RollCallSummaryMarkStatus,
      extraMetadata?: RollCallMarkMetadata,
    ) => {
      if (!classId) throw new Error('Class id is required.');

      const deckStatus = status as RollCallDeckMarkStatus;
      const metadata: RollCallMarkMetadata | undefined =
        status === 'left_early'
          ? extraMetadata
          : {
              ...buildRollCallMarkMetadata(member, deckStatus),
              ...extraMetadata,
            };

      // Defer cache write so the swipe commit paint isn't competing with a
      // parent React Query re-render in the same frame.
      queueMicrotask(() => {
        queryClient.setQueryData<RollCallState>(rollCallKey(classId), (current) => {
          if (!current) return current;
          return applyOptimisticRollCallMark(
            current,
            {
              userId: member.userId,
              mindbodyClientId: member.mindbodyClientId,
              status,
              method: member.isWalkIn ? 'walk_in' : 'roll_call',
              metadata,
            },
            member.deckKey,
            coachId,
          );
        });
      });
    },
    [classId, coachId, queryClient],
  );

  const recordFromSwipe = useCallback(
    async (member: RollCallDeckMember, direction: RollCallSwipeCommit) => {
      await recordWithStatus(member, swipeCommitToStatus(direction));
    },
    [recordWithStatus],
  );

  const handleRecordError = useCallback(
    (error: unknown) => {
      showAlert('Could not save attendance', formatMarkError(error));
    },
    [showAlert],
  );

  const revertMark = useCallback(
    async (
      member: RollCallDeckMember,
      previousMark: RollCallMemberMark | null,
      _removedMark: RollCallMemberMark | null,
    ) => {
      if (!classId) return;

      queryClient.setQueryData<RollCallState>(rollCallKey(classId), (current) => {
        if (!current) return current;
        return patchRollCallDeckMark(current, member.deckKey, previousMark);
      });
    },
    [classId, queryClient],
  );

  return {
    isRecording: false,
    recordWithStatus,
    recordFromSwipe,
    revertMark,
    handleRecordError,
  };
}
