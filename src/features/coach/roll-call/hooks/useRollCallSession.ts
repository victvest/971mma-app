import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { toUserFacingErrorMessage } from '@/lib/userFacingError';

function formatSessionError(error: unknown): string {
  return toUserFacingErrorMessage(error, { fallback: 'Check your connection and try again.' });
}

export function useRollCallSession(classId: string | null) {
  const { showAlert } = useDialog();
  const rollCallQuery = useRollCallState(classId);
  const { mutate: startRollCall, isPending: isStarting } = useStartRollCall(classId);
  const abandonMutation = useAbandonRollCall(classId);
  /** Prevents start → invalidate → refetch → start storms when session lags behind. */
  const startAttemptedForClassRef = useRef<string | null>(null);
  const [startFailed, setStartFailed] = useState(false);

  const session = rollCallQuery.data?.session ?? null;
  const deck = rollCallQuery.data?.deck ?? [];

  const isCompleted = isRollCallSessionCompleted(session);
  const isInProgress = isRollCallSessionInProgress(session);
  const unmarkedCount = useMemo(() => countUnmarkedDeckMembers(deck), [deck]);
  const isResuming = useMemo(() => isRollCallResuming(session, deck), [deck, session]);
  const hasProgress = useMemo(() => rollCallExitHasProgress(deck, session), [deck, session]);

  useEffect(() => {
    startAttemptedForClassRef.current = null;
    setStartFailed(false);
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    if (rollCallQuery.isLoading || rollCallQuery.isFetching || rollCallQuery.isError) return;
    if (isCompleted || isInProgress) return;
    if (isStarting) return;
    if (!getNetworkOnline()) return;
    if (startAttemptedForClassRef.current === classId) return;

    startAttemptedForClassRef.current = classId;
    startRollCall(undefined, {
      onError: (error) => {
        startAttemptedForClassRef.current = null;
        setStartFailed(true);
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
    rollCallQuery.isFetching,
    rollCallQuery.isLoading,
    showAlert,
    startRollCall,
  ]);

  const abandonSession = useCallback(async () => {
    if (!session?.id) {
      throw new Error('No active roll call session.');
    }
    startAttemptedForClassRef.current = null;
    setStartFailed(false);
    await abandonMutation.mutateAsync(session.id);
  }, [abandonMutation, session?.id]);

  const isBootstrapping =
    Boolean(classId) &&
    !rollCallQuery.isError &&
    (!rollCallQuery.isSuccess ||
      isStarting ||
      (!isInProgress && !isCompleted && !startFailed));

  return {
    rollCallQuery,
    session,
    deck,
    isCompleted,
    isInProgress,
    isStarting,
    isBootstrapping,
    isResuming,
    unmarkedCount,
    hasProgress,
    isAbandoning: abandonMutation.isPending,
    abandonSession,
  };
}
