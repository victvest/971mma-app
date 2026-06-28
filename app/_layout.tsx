import '@/shared/i18n';

import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
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

function RootStack() {
  const { colors } = useTheme();
  const pushOptions = createStackScreenOptions(colors.background.primary, 'push');
  const fadeOptions = createStackScreenOptions(colors.background.primary, 'fade');

  return (
    <Stack screenOptions={pushOptions}>
      <Stack.Screen name="index" options={fadeOptions} />
      <Stack.Screen name="(auth)" options={fadeOptions} />
      <Stack.Screen name="(onboarding)" options={fadeOptions} />
      <Stack.Screen name="(tabs)" options={fadeOptions} />
      <Stack.Screen name="(coach)" options={pushOptions} />
      <Stack.Screen name="(gate)" options={fadeOptions} />
      <Stack.Screen name="classes" options={pushOptions} />
      <Stack.Screen name="coaches" options={pushOptions} />
      <Stack.Screen name="about" options={pushOptions} />
      <Stack.Screen name="lineage" options={pushOptions} />
      <Stack.Screen name="notifications" options={pushOptions} />
      <Stack.Screen name="attendance" options={pushOptions} />
      <Stack.Screen name="family-trainees" options={pushOptions} />
      <Stack.Screen name="edit-profile" options={pushOptions} />
      <Stack.Screen name="delete-account" options={pushOptions} />
      <Stack.Screen name="change-password" options={pushOptions} />
      <Stack.Screen name="help" options={pushOptions} />
      <Stack.Screen name="privacy" options={pushOptions} />
      <Stack.Screen name="terms" options={pushOptions} />
    </Stack>
  );
}

import { authToast } from '@/shared/components/Toast';

function NavigationGuard() {
  const { initializing, passwordRecoveryActive, completingSignupVerification, signOut } = useAuth();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const needsOnboarding = useAuthStore((state) => state.needsOnboarding);
  const role = useAuthStore((state) => state.role);
  const accountStatus = useAuthStore((state) => state.user?.accountStatus);
  const segments = useSegments();
  const pathname = usePathname();
  const router = useRouter();
  const lastRedirectRef = useRef<string | null>(null);

  useEffect(() => {
    if (initializing) return;
    if (isAuthenticated && role === 'admin') {
      void signOut();
      authToast.error('Access Denied', 'Admins must use the Admin Web Portal.');
    }
  }, [initializing, isAuthenticated, role, signOut]);

  const redirectTarget = useMemo(() => {
    if (initializing) return null;

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
    completingSignupVerification,
    initializing,
    isAuthenticated,
    needsOnboarding,
    passwordRecoveryActive,
    pathname,
    role,
    segments,
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
