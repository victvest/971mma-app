import { useCallback, useEffect, useMemo } from 'react';
import {
  useAbandonRollCall,
  useRollCallState,
  useStartRollCall,
} from '@/features/coach/roll-call/hooks/useRollCall';
import {
  countUnmarkedDeckMembers,
  isRollCallResuming,
  isRollCallSessionCompleted,
  isRollCallSessionInProgress,
  rollCallExitHasProgress,
} from '@/features/coach/roll-call/utils/rollCallSession';
import { getNetworkOnline } from '@/stores/useAppConnectivityStore';
import { useDialog } from '@/shared/components/Dialog/useDialog';

function formatSessionError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return 'Check your connection and try again.';
}

export function useRollCallSession(classId: string | null) {
  const { showAlert } = useDialog();
  const rollCallQuery = useRollCallState(classId);
  const { mutate: startRollCall, isPending: isStarting } = useStartRollCall(classId);
  const abandonMutation = useAbandonRollCall(classId);

  const session = rollCallQuery.data?.session ?? null;
  const deck = rollCallQuery.data?.deck ?? [];

  const isCompleted = isRollCallSessionCompleted(session);
  const isInProgress = isRollCallSessionInProgress(session);
  const unmarkedCount = useMemo(() => countUnmarkedDeckMembers(deck), [deck]);
  const isResuming = useMemo(() => isRollCallResuming(session, deck), [deck, session]);
  const hasProgress = useMemo(
    () => rollCallExitHasProgress(deck, session),
    [deck, session],
  );

  useEffect(() => {
    if (!classId || rollCallQuery.isLoading || rollCallQuery.isError) return;
    if (isCompleted || isInProgress) return;
    if (isStarting) return;
    if (!getNetworkOnline()) return;

    startRollCall(undefined, {
      onError: (error) => {
        const message = formatSessionError(error);
        if (!getNetworkOnline()) {
          showAlert(
            'Connect to start roll call',
            'Roll call needs an internet connection to load the roster and begin.',
          );
          return;
        }
        showAlert('Could not start roll call', message);
      },
    });
  }, [
    classId,
    isCompleted,
    isInProgress,
    isStarting,
    rollCallQuery.isError,
    rollCallQuery.isLoading,
    showAlert,
    startRollCall,
  ]);

  const abandonSession = useCallback(async () => {
    if (!session?.id) {
      throw new Error('No active roll call session.');
    }
    await abandonMutation.mutateAsync(session.id);
  }, [abandonMutation, session?.id]);

  return {
    rollCallQuery,
    session,
    deck,
    isCompleted,
    isInProgress,
    isStarting,
    isResuming,
    unmarkedCount,
    hasProgress,
    isAbandoning: abandonMutation.isPending,
    abandonSession,
  };
}
