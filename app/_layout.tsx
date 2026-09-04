import '@/shared/i18n';

import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, View, LogBox } from 'react-native';

LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported in Expo Go',
]);
import { Stack, usePathname, useRouter, useSegments, type Href } from 'expo-router';
import { AppProviders } from '@/core/providers/AppProviders';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useAuthStore } from '@/stores/useAuthStore';
import { createStackScreenOptions } from '@/shared/navigation/stackScreenOptions';
import {
  isAtNavigationTarget,
  resolveNavigationRedirect,
} from '@/shared/navigation/navigationGuard';
import { useTheme } from '@/shared/theme';
import { useActiveMemberId, useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { installBugTelemetry, setBugTelemetryRoute } from '@/services/bug-reporting';

installBugTelemetry();

function RootStack() {
  const { colors } = useTheme();
  const pushOptions = createStackScreenOptions(colors.background.primary, 'push');
  const fadeOptions = createStackScreenOptions(colors.background.primary, 'fade');

  return (
    <Stack screenOptions={pushOptions}>
      <Stack.Screen name="index" options={fadeOptions} />
      <Stack.Screen name="auth/callback" options={{ ...fadeOptions, headerShown: false }} />
      <Stack.Screen name="activation-required" options={pushOptions} />
      <Stack.Screen name="(auth)" options={fadeOptions} />
      <Stack.Screen name="(onboarding)" options={fadeOptions} />
      <Stack.Screen name="(tabs)" options={fadeOptions} />
      <Stack.Screen name="(coach)" options={pushOptions} />
      <Stack.Screen name="classes" options={pushOptions} />
      <Stack.Screen name="coaches" options={pushOptions} />
      <Stack.Screen name="feed" options={pushOptions} />
      <Stack.Screen name="about" options={pushOptions} />
      <Stack.Screen name="lineage" options={pushOptions} />
      <Stack.Screen name="notifications" options={pushOptions} />
      <Stack.Screen name="referrals" options={pushOptions} />
      <Stack.Screen name="attendance" options={pushOptions} />
      <Stack.Screen name="family-trainees" options={pushOptions} />
      <Stack.Screen name="edit-profile" options={pushOptions} />
      <Stack.Screen name="delete-account" options={pushOptions} />
      <Stack.Screen name="change-password" options={pushOptions} />
      <Stack.Screen name="help" options={pushOptions} />
      <Stack.Screen name="legal" options={pushOptions} />
      <Stack.Screen name="mindbody-info" options={pushOptions} />
      <Stack.Screen name="privacy" options={pushOptions} />
      <Stack.Screen name="terms" options={pushOptions} />
    </Stack>
  );
}

import { authToast } from '@/shared/components/Toast';

const CHILD_PROFILE_BLOCKED_PREFIXES = [
  '/about',
  '/classes',
  '/coaches',
  '/change-password',
  '/delete-account',
  '/edit-profile',
  '/family-trainees',
  '/help',
  '/legal',
  '/lineage',
  '/mindbody-info',
  '/notifications',
  '/privacy',
  '/referrals',
  '/rewards',
  '/schedule',
  '/terms',
] as const;

function normalizePathname(pathname: string): string {
  return (
    pathname
      .replace(/\/\([^)]+\)/g, '')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/'
  );
}

function pathStartsWith(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function resolveChildProfileRedirect(
  segments: string[],
  pathname: string,
  activeMemberId: string,
): Href | null {
  const normalized = normalizePathname(pathname);
  const [firstSegment] = segments;

  if (firstSegment === '(coach)') {
    return '/(tabs)';
  }

  if (normalized === '/feed/search') {
    return '/(tabs)/feed';
  }

  if (normalized.startsWith('/feed/user/')) {
    const profileId = decodeURIComponent(normalized.replace('/feed/user/', '').split('/')[0] ?? '');
    return profileId && profileId === activeMemberId ? null : '/(tabs)/feed';
  }

  if (CHILD_PROFILE_BLOCKED_PREFIXES.some((prefix) => pathStartsWith(normalized, prefix))) {
    return '/(tabs)';
  }

  return null;
}

function NavigationGuard() {
  const { initializing, passwordRecoveryActive, completingSignupVerification, signOut } = useAuth();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const needsOnboarding = useAuthStore((state) => state.needsOnboarding);
  const role = useAuthStore((state) => state.role);
  const accountStatus = useAuthStore((state) => state.user?.accountStatus);
  const viewingChild = useIsViewingChildProfile();
  const activeMemberId = useActiveMemberId();
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    setBugTelemetryRoute(pathname);
  }, [pathname]);



  const redirectTarget = useMemo(() => {
    if (initializing) return null;

    if (viewingChild) {
      const childRedirect = resolveChildProfileRedirect(
        segments as string[],
        pathname,
        activeMemberId,
      );
      if (childRedirect) return childRedirect;
    }

    return resolveNavigationRedirect({
      segments: segments as string[],
      pathname,
      isAuthenticated,
      needsOnboarding,
      passwordRecoveryActive,
      completingSignupVerification,
      role,
      accountStatus,
    });
  }, [
    accountStatus,
    activeMemberId,
    completingSignupVerification,
    initializing,
    isAuthenticated,
    needsOnboarding,
    passwordRecoveryActive,
    pathname,
    role,
    segments,
    viewingChild,
  ]);

  useEffect(() => {
    if (initializing) return;

    if (!redirectTarget) {
      lastRedirectRef.current = null;
      return;
    }

    if (isAtNavigationTarget(segments as string[], pathname, redirectTarget)) {
      lastRedirectRef.current = null;
      return;
    }

    const targetKey =
      typeof redirectTarget === 'string' ? redirectTarget : JSON.stringify(redirectTarget);
    const redirectKey = `${targetKey}:${pathname}`;
    if (lastRedirectRef.current === redirectKey) return;

    lastRedirectRef.current = redirectKey;
    queueMicrotask(() => {
      router.replace(redirectTarget);
    });
  }, [initializing, isAuthenticated, pathname, redirectTarget, router, segments]);

  if (initializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <RootStack />;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <NavigationGuard />
      </AppProviders>
    </ErrorBoundary>
  );
}
