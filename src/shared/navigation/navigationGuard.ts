import type { Href } from 'expo-router';
import { getDefaultHomeRoute } from '@/shared/navigation/defaultHomeRoute';
import type { UserRole } from '@/features/auth/types';
import type { AppUser } from '@/stores/useAuthStore';

const SKIP_ACTIVATION_GATING = process.env.EXPO_PUBLIC_SKIP_ACTIVATION_GATING === 'true';

type RouteFlags = {
  inAuthGroup: boolean;
  inChangePasswordRoute: boolean;
  inVerifyEmailRoute: boolean;
  inResetVerifyOtpRoute: boolean;
  inSplashRoute: boolean;
  inAuthCallbackRoute: boolean;
  inActivationRequiredRoute: boolean;
  inOnboardingGroup: boolean;
  inCoachGroup: boolean;
  inGateGroup: boolean;
  inTabsGroup: boolean;
  inDetailGroup: boolean;
  inProtectedGroup: boolean;
};

export type NavigationGuardInput = {
  segments: string[];
  pathname: string;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  passwordRecoveryActive: boolean;
  completingSignupVerification: boolean;
  role: UserRole | null;
  accountStatus: AppUser['accountStatus'] | undefined;
};

export type AuthenticatedRouteInput = {
  role: UserRole | null;
  accountStatus: AppUser['accountStatus'] | undefined;
  needsOnboarding: boolean;
};

function normalizePath(path: string): string {
  return path
    .replace(/\/\([^)]+\)/g, '')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '') || '/';
}

function pathnameMatchesScreen(pathname: string, screen: string): boolean {
  const normalized = normalizePath(pathname);
  const normalizedScreen = normalizePath(`/${screen}`);
  return normalized === normalizedScreen || normalized.endsWith(normalizedScreen);
}

function isOnAuthScreen(segments: string[], pathname: string, screen: string): boolean {
  const [firstSegment, secondSegment] = segments;
  return (
    (firstSegment === '(auth)' && secondSegment === screen) ||
    pathnameMatchesScreen(pathname, screen)
  );
}

function parseRouteFlags(segments: string[]): RouteFlags {
  const [firstSegment, secondSegment] = segments;
  const inAuthGroup = firstSegment === '(auth)';
  const inChangePasswordRoute = inAuthGroup && secondSegment === 'change-password';
  const inVerifyEmailRoute = inAuthGroup && secondSegment === 'verify-email';
  const inResetVerifyOtpRoute = inAuthGroup && secondSegment === 'reset-verify-otp';
  const inSplashRoute = inAuthGroup && secondSegment === 'splash';
  const inAuthCallbackRoute = firstSegment === 'auth' && secondSegment === 'callback';
  const inActivationRequiredRoute =
    firstSegment === 'activation-required' ||
    (inAuthGroup && secondSegment === 'activation-required');
  const inOnboardingGroup = firstSegment === '(onboarding)';
  const inCoachGroup = firstSegment === '(coach)';
  const inGateGroup = firstSegment === '(gate)';
  const inTabsGroup = firstSegment === '(tabs)';
  const inDetailGroup =
    firstSegment === 'classes' ||
    firstSegment === 'coaches' ||
    firstSegment === 'lineage' ||
    firstSegment === 'about' ||
    firstSegment === 'notifications' ||
    firstSegment === 'attendance' ||
    firstSegment === 'family-trainees' ||
    firstSegment === 'communities' ||
    firstSegment === 'edit-profile' ||
    firstSegment === 'delete-account' ||
    firstSegment === 'change-password' ||
    firstSegment === 'help' ||
    firstSegment === 'legal' ||
    firstSegment === 'privacy' ||
    firstSegment === 'terms';

  return {
    inAuthGroup,
    inChangePasswordRoute,
    inVerifyEmailRoute,
    inResetVerifyOtpRoute,
    inSplashRoute,
    inAuthCallbackRoute,
    inActivationRequiredRoute,
    inOnboardingGroup,
    inCoachGroup,
    inGateGroup,
    inTabsGroup,
    inDetailGroup,
    inProtectedGroup: inTabsGroup || inCoachGroup || inGateGroup || inDetailGroup,
  };
}

export function memberRequiresActivation(
  role: UserRole | null,
  accountStatus: AppUser['accountStatus'] | undefined,
): boolean {
  if (SKIP_ACTIVATION_GATING) return false;
  return role === 'member' && accountStatus !== 'active';
}

export function getAuthenticatedEntryRoute(input: AuthenticatedRouteInput): Href {
  if (memberRequiresActivation(input.role, input.accountStatus)) {
    return '/(tabs)';
  }

  if (input.needsOnboarding) {
    return '/(onboarding)';
  }

  return getDefaultHomeRoute(input.role);
}

export function resolveNavigationRedirect(input: NavigationGuardInput): Href | null {
  const {
    segments,
    pathname,
    isAuthenticated,
    needsOnboarding,
    passwordRecoveryActive,
    completingSignupVerification,
    role,
    accountStatus,
  } = input;
  const route = parseRouteFlags(segments);
  const inActivationRequiredRoute =
    route.inActivationRequiredRoute ||
    isOnAuthScreen(segments, pathname, 'activation-required');
  const inChangePasswordRoute =
    route.inChangePasswordRoute || isOnAuthScreen(segments, pathname, 'change-password');
  const inVerifyEmailRoute =
    route.inVerifyEmailRoute || isOnAuthScreen(segments, pathname, 'verify-email');
  const inResetVerifyOtpRoute =
    route.inResetVerifyOtpRoute || isOnAuthScreen(segments, pathname, 'reset-verify-otp');
  const inSplashRoute = route.inSplashRoute || isOnAuthScreen(segments, pathname, 'splash');
  const inAuthCallbackRoute =
    route.inAuthCallbackRoute || pathnameMatchesScreen(pathname, 'auth/callback');
  const defaultHome = getDefaultHomeRoute(role);
  const canUseCoachRoutes = role === 'coach';
  const canUseGateRoutes = role === 'gate';
  const canUseChangePasswordRoute = isAuthenticated || passwordRecoveryActive;
  const requiresActivation = memberRequiresActivation(role, accountStatus);
  const authenticatedEntry = getAuthenticatedEntryRoute({ role, accountStatus, needsOnboarding });

  if (inAuthCallbackRoute) {
    return null;
  }

  // Pending-activation members must be able to open the activation screen even when
  // EXPO_PUBLIC_SKIP_ACTIVATION_GATING bypasses tab-level blocking in local dev.
  if (isAuthenticated && inActivationRequiredRoute) {
    if (role === 'member' && accountStatus !== 'active') {
      return null;
    }
    return authenticatedEntry;
  }

  // If they require activation but are on onboarding, send them to tabs (guest mode)
  if (isAuthenticated && requiresActivation && route.inOnboardingGroup) {
    return '/(tabs)';
  }

  if (inChangePasswordRoute && !canUseChangePasswordRoute) {
    return '/(auth)';
  }

  if (
    isAuthenticated &&
    needsOnboarding &&
    !route.inOnboardingGroup &&
    !requiresActivation
  ) {
    return '/(onboarding)';
  }

  if (isAuthenticated && !needsOnboarding && route.inOnboardingGroup) {
    return defaultHome;
  }

  if (
    !isAuthenticated &&
    (route.inProtectedGroup || route.inOnboardingGroup || inActivationRequiredRoute)
  ) {
    return '/(auth)';
  }

  if (isAuthenticated && route.inCoachGroup && !canUseCoachRoutes) {
    return '/(tabs)';
  }

  if (isAuthenticated && route.inGateGroup && !canUseGateRoutes) {
    return defaultHome;
  }

  if (
    isAuthenticated &&
    role === 'gate' &&
    !needsOnboarding &&
    (route.inTabsGroup || route.inCoachGroup || route.inDetailGroup)
  ) {
    return '/(gate)/display';
  }

  if (
    isAuthenticated &&
    route.inAuthGroup &&
    !inChangePasswordRoute &&
    !inVerifyEmailRoute &&
    !inResetVerifyOtpRoute &&
    !inSplashRoute &&
    !inActivationRequiredRoute &&
    !completingSignupVerification &&
    !passwordRecoveryActive
  ) {
    if (requiresActivation) {
      const inAuthShellOnly = segments.length === 1;
      if (inAuthShellOnly) {
        return null;
      }
    }
    return authenticatedEntry;
  }

  if (isAuthenticated && inSplashRoute) {
    return authenticatedEntry;
  }

  return null;
}

export function isAtNavigationTarget(
  segments: string[],
  pathname: string,
  target: Href,
): boolean {
  const href = typeof target === 'string' ? target : '';
  if (!href) return false;

  const targetParts = href.split('/').filter(Boolean);
  if (targetParts.length === 0) return false;

  if (targetParts.every((part, index) => segments[index] === part)) {
    return true;
  }

  const leaf = targetParts[targetParts.length - 1];
  if (!leaf.startsWith('(')) {
    return pathnameMatchesScreen(pathname, leaf);
  }

  return false;
}
