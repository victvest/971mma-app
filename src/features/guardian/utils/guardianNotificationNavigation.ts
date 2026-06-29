import { useActiveProfileStore } from '@/stores/useActiveProfileStore';

function readTraineeUserId(payload: Record<string, unknown>): string | null {
  const traineeUserId = payload.traineeUserId ?? payload.trainee_user_id;
  return typeof traineeUserId === 'string' && traineeUserId.trim() ? traineeUserId.trim() : null;
}

export function applyGuardianNotificationContext(payload: Record<string, unknown>): void {
  const traineeUserId = readTraineeUserId(payload);
  if (!traineeUserId) return;
  useActiveProfileStore.getState().setActiveUserId(traineeUserId);
}

export function guardianNotificationHref(payload: Record<string, unknown>): string | null {
  const url = payload.url;
  if (typeof url === 'string' && url.startsWith('/')) {
    return url;
  }

  const eventType = typeof payload.eventType === 'string' ? payload.eventType.toLowerCase() : '';

  if (eventType === 'promotion') return '/(tabs)/belt-path';
  if (eventType === 'milestone') return '/(tabs)/rewards';
  if (eventType === 'check_in' || eventType === 'inactivity') return '/family-trainees';

  return '/family-trainees';
}
