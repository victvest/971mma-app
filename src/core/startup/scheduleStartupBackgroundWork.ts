import { InteractionManager } from 'react-native';
import { runMindbodyLinkOnce, resetMindbodyLinkOnceState } from '@/features/auth/services/mindbodyLinkOnce';
import { registerForPushNotifications } from '@/features/notifications/services/pushRegistration';
import { PerfMark, perfMarkOnce } from '@/shared/performance';
import {
  getScheduledStartupUserId,
  isStartupBackgroundWorkComplete,
  markStartupBackgroundWorkComplete,
  resetStartupBackgroundState,
  setScheduledStartupUserId,
} from './startupBackgroundState';

export { isStartupBackgroundWorkComplete } from './startupBackgroundState';

let cancelPendingWork: (() => void) | null = null;

export function resetStartupBackgroundWork(): void {
  cancelPendingWork?.();
  cancelPendingWork = null;
  resetStartupBackgroundState();
  resetMindbodyLinkOnceState();
}

export function scheduleStartupBackgroundWork(userId: string): void {
  if (isStartupBackgroundWorkComplete(userId) || getScheduledStartupUserId() === userId) return;

  cancelPendingWork?.();
  setScheduledStartupUserId(userId);
  perfMarkOnce(PerfMark.startupBackgroundScheduled, { userId });

  const handle = InteractionManager.runAfterInteractions(() => {
    void (async () => {
      if (getScheduledStartupUserId() !== userId) return;

      try {
        await runMindbodyLinkOnce(userId);
        if (getScheduledStartupUserId() !== userId) return;

        await registerForPushNotifications({ requestPermission: false });
      } finally {
        if (getScheduledStartupUserId() === userId) {
          markStartupBackgroundWorkComplete(userId);
          perfMarkOnce(PerfMark.startupBackgroundComplete, { userId });
        }
      }
    })();
  });

  cancelPendingWork = () => {
    handle.cancel();
  };
}
