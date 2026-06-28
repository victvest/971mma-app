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

  useEffect(() => {
    if (initializing) return;

    if (!isAuthenticated || !userId) {
      resetStartupBackgroundWork();
      return;
    }

    scheduleStartupBackgroundWork(userId);
  }, [initializing, isAuthenticated, userId]);

  return null;
}
