import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAppFonts } from '@/core/fonts/useAppFonts';
import { ThemeProvider, useTheme } from '@/shared/theme';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { ActiveMemberProvider } from '@/features/guardian/context/ActiveMemberProvider';
import { queryClient } from '@/lib/queryClient';
import { toast, toastConfig } from '@/shared/components/Toast';
import { DialogProvider } from '@/shared/components/Dialog';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { OfflineBanner } from '@/shared/components/OfflineBanner';
import { useRollCallOfflineFlush } from '@/features/coach/roll-call/hooks/useRollCallOfflineFlush';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { useOfflineBannerVisible } from '@/shared/hooks/useOfflineBannerVisible';
import { usePushNotifications } from '@/features/notifications/hooks/usePushNotifications';
import { StartupBackgroundMonitor } from '@/core/startup/StartupBackgroundMonitor';
import { exposePerfToolsOnGlobal, PerfMark, perfMarkOnce } from '@/shared/performance';

function RollCallOfflineFlushMonitor() {
  const role = useAuthStore((state) => state.role);
  const enabled = role === 'coach';
  useRollCallOfflineFlush(enabled);
  return null;
}

function PushNotificationMonitor() {
  usePushNotifications();
  return null;
}

function FontGate({ children }: { children: React.ReactNode }) {
  const [fontsLoaded, fontError] = useAppFonts();
  const { colors } = useTheme();

  useEffect(() => {
    exposePerfToolsOnGlobal();
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;
    perfMarkOnce(PerfMark.appFontsReady);
  }, [fontsLoaded]);

  if (fontError) {
    throw fontError;
  }

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background.primary,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent.default} />
      </View>
    );
  }

  return <>{children}</>;
}

function AppToastRoot() {
  const insets = useSafeAreaInsets();
  const offlineBannerVisible = useOfflineBannerVisible();
  const topOffset = offlineBannerVisible ? insets.top + 52 : insets.top + 12;
  return <Toast config={toastConfig} topOffset={topOffset} />;
}

function OfflineMonitor() {
  const { isOnline } = useNetworkStatus();
  const mounted = useRef(false);
  const pendingOnlineRef = useRef(isOnline);

  useEffect(() => {
    pendingOnlineRef.current = isOnline;

    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    const timer = setTimeout(() => {
      if (pendingOnlineRef.current !== isOnline) return;
      if (!isOnline) {
        toast.warning('No connection', 'Some features may be unavailable.');
      } else {
        toast.success('Back online', 'Your connection has been restored.');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isOnline]);

  return null;
}

function OfflineReconnectMonitor() {
  const offlineBannerVisible = useOfflineBannerVisible();
  const { isOnline } = useNetworkStatus();
  const queryClient = useQueryClient();
  const prevOnlineRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!offlineBannerVisible) {
      prevOnlineRef.current = isOnline;
      return;
    }

    if (AppState.currentState !== 'active') {
      prevOnlineRef.current = isOnline;
      return;
    }

    const wasOffline = prevOnlineRef.current === false;
    if (wasOffline && isOnline) {
      void queryClient.invalidateQueries();
    }

    prevOnlineRef.current = isOnline;
  }, [offlineBannerVisible, isOnline, queryClient]);

  return null;
}

function ThemedAppShell({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <AppStatusBar />
      <OfflineBanner />
      <View style={{ flex: 1 }}>
        <AuthProvider>
          <ActiveMemberProvider>
            {children}
            <StartupBackgroundMonitor />
          </ActiveMemberProvider>
        </AuthProvider>
      </View>
    </View>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider initialMode="light">
          <FontGate>
            <QueryClientProvider client={queryClient}>
              <ThemedAppShell>{children}</ThemedAppShell>

              <RollCallOfflineFlushMonitor />
              <PushNotificationMonitor />
              <DialogProvider />

              <OfflineMonitor />
              <OfflineReconnectMonitor />

              <AppToastRoot />
            </QueryClientProvider>
          </FontGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
