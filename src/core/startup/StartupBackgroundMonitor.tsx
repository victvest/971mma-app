import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  resetStartupBackgroundWork,
  scheduleStartupBackgroundWork,
} from './scheduleStartupBackgroundWork';

export function StartupBackgroundMonitor() {
  const { initializing } = useAuth();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const isDemoUser = useAuthStore((state) => state.user?.demo === true);

  useEffect(() => {
    if (initializing) return;

    if (!isAuthenticated || !userId) {
      resetStartupBackgroundWork();
      return;
    }

    scheduleStartupBackgroundWork(userId, { skipMindbodyLink: isDemoUser });
  }, [initializing, isAuthenticated, isDemoUser, userId]);

  return null;
}
