import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@/stores/useAuthStore';
import { getAuthenticatedEntryRoute } from '@/shared/navigation/navigationGuard';
import { PerfMark, perfMarkOnce } from '@/shared/performance';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);
  const accountStatus = useAuthStore((s) => s.user?.accountStatus);
  const needsOnboarding = useAuthStore((s) => s.needsOnboarding);
  const authenticatedRoute = getAuthenticatedEntryRoute({ role, accountStatus, needsOnboarding });

  useEffect(() => {
    perfMarkOnce(PerfMark.authRouted, {
      isAuthenticated,
      role,
      route: isAuthenticated ? authenticatedRoute : '/(auth)',
    });
  }, [authenticatedRoute, isAuthenticated, role]);

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/splash" />;
  }

  return <Redirect href={authenticatedRoute} />;
}
