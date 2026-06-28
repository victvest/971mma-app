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
import {
  rollCallKey,
  useRecordRollCallMark,
} from '@/features/coach/roll-call/hooks/useRollCall';
import {
  patchRollCallDeckMark,
  swipeCommitToStatus,
} from '@/features/coach/roll-call/utils/optimisticRollCallMark';
import { buildRollCallMarkMetadata } from '@/features/coach/roll-call/utils/buildRollCallMarkMetadata';
import {
  demoClearRollCallMark,
  shouldUseDemoRollCall,
} from '@/features/coach/demo/coachDemoRollCallStore';
import { isCoachDemoMode } from '@/features/coach/demo/coachDemoMode';
import { getNetworkOnline } from '@/stores/useAppConnectivityStore';
import type { RollCallSwipeCommit } from '@/features/coach/roll-call/utils/rollCallGestures';
import { clearRollCallMark } from '@/services/database/rollCall.repository';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { useDialog } from '@/shared/components/Dialog/useDialog';
import { useRollCallOfflineQueueStore } from '@/stores/useRollCallOfflineQueueStore';

export type RollCallDeckMarkStatus = Extract<RollCallMemberStatus, 'present' | 'absent' | 'late'>;

export type RollCallSummaryMarkStatus = Extract<
  RollCallMemberStatus,
  'present' | 'absent' | 'late' | 'left_early'
>;

function formatMarkError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Check your connection and try again.';
}

async function maybeAutoFacilityCheckIn(
  member: RollCallDeckMember,
  status: RollCallDeckMarkStatus,
  config: RollCallConfig,
  classId: string,
): Promise<void> {
  if (!config.autoFacilityCheckinOnPresent) return;
  if (status !== 'present' && status !== 'late') return;
  if (member.hasFacilityCheckInToday || !member.userId) return;

  if (!getNetworkOnline()) return;

  try {
    await invokeEdge('mb-checkin', { userId: member.userId, classId });
  } catch {
    // Best-effort bridge — roll call mark already saved.
  }
}

export function useRollCallDeckMarking(
  classId: string | null,
  config: RollCallConfig = DEFAULT_ROLL_CALL_CONFIG,
) {
  const queryClient = useQueryClient();
  const { showAlert } = useDialog();
  const recordMarkMutation = useRecordRollCallMark(classId);

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

      await recordMarkMutation.mutateAsync({
        userId: member.userId,
        mindbodyClientId: member.mindbodyClientId,
        status,
        method: member.isWalkIn ? 'walk_in' : 'roll_call',
        metadata,
      });

      if (status === 'present' || status === 'late') {
        await maybeAutoFacilityCheckIn(member, status, config, classId);
      }
    },
    [classId, config, recordMarkMutation],
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
      removedMark: RollCallMemberMark | null,
    ) => {
      if (!classId) return;

      queryClient.setQueryData<RollCallState>(rollCallKey(classId), (current) => {
        if (!current) return current;
        return patchRollCallDeckMark(current, member.deckKey, previousMark);
      });

      if (!removedMark) {
        if (isCoachDemoMode() && shouldUseDemoRollCall(classId)) {
          demoClearRollCallMark(classId, member.deckKey);
        }
        return;
      }

      if (removedMark.id.startsWith('optimistic-')) return;

      if (removedMark.id.startsWith('queued-')) {
        const clientGeneratedId = removedMark.metadata?.client_generated_id;
        if (typeof clientGeneratedId === 'string') {
          useRollCallOfflineQueueStore.getState().removeByClientId(clientGeneratedId);
        }
        return;
      }

      try {
        await clearRollCallMark({
          markId: removedMark.id,
          classId,
          deckKey: member.deckKey,
        });
      } catch (error) {
        queryClient.setQueryData<RollCallState>(rollCallKey(classId), (current) => {
          if (!current) return current;
          return patchRollCallDeckMark(current, member.deckKey, removedMark);
        });
        showAlert('Could not undo mark', formatMarkError(error));
        void queryClient.invalidateQueries({ queryKey: rollCallKey(classId) });
        throw error;
      }
    },
    [classId, queryClient, showAlert],
  );

  return {
    isRecording: recordMarkMutation.isPending,
    recordWithStatus,
    recordFromSwipe,
    revertMark,
    handleRecordError,
  };
}
