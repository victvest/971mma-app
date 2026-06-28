import type { Href } from 'expo-router';
import { getAuthenticatedEntryRoute } from '@/shared/navigation/navigationGuard';
import { useAuthStore } from '@/stores/useAuthStore';

export function navigateAfterAuthentication(replace: (href: Href) => void): void {
  const { role, user, needsOnboarding } = useAuthStore.getState();
  replace(
    getAuthenticatedEntryRoute({
      role,
      accountStatus: user?.accountStatus,
      needsOnboarding,
    }),
  );
}
