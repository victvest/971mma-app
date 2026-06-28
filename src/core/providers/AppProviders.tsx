import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { enableFreeze } from 'react-native-screens';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAppFonts } from '@/core/fonts/useAppFonts';
import { ThemeProvider, useTheme } from '@/shared/theme';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { ActiveMemberProvider } from '@/features/guardian/context/ActiveMemberProvider';
import { queryClient } from '@/lib/queryClient';
import { toast, toastConfig } from '@/shared/components/Toast';
import { DialogProvider } from '@/shared/components/Dialog';
import { AppStatusBar } from '@/shared/components/AppStatusBar';
import { useRollCallOfflineFlush } from '@/features/coach/roll-call/hooks/useRollCallOfflineFlush';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { usePushNotifications } from '@/features/notifications/hooks/usePushNotifications';
import { StartupBackgroundMonitor } from '@/core/startup/StartupBackgroundMonitor';
import {
  exposePerfToolsOnGlobal,
  PerfMark,
  perfMarkOnce,
} from '@/shared/performance';

enableFreeze(true);

function RollCallOfflineFlushMonitor() {
  const role = useAuthStore((state) => state.role);
  const enabled = role === 'coach' || role === 'admin';
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background.primary }}>
        <ActivityIndicator size="large" color={colors.accent.default} />
      </View>
    );
  }

  return <>{children}</>;
}

function AppToastRoot() {
  const insets = useSafeAreaInsets();
  return <Toast config={toastConfig} topOffset={insets.top + 12} />;
}

function OfflineMonitor() {
  const { isOnline } = useNetworkStatus();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (!isOnline) {
      toast.warning('No connection', 'Some features may be unavailable.');
    } else {
      toast.success('Back online', 'Your connection has been restored.');
    }
  }, [isOnline]);

  return null;
}

function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { colors, typography } = useTheme();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View
      style={{
        backgroundColor: colors.status.error,
        paddingTop: insets.top > 0 ? insets.top : 8,
        paddingBottom: 8,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[typography.textPresets.bodyStrong, { color: colors.text.inverse, textAlign: 'center' }]}>
        You are offline. Some features may be unavailable.
      </Text>
    </View>
  );
}

function ThemedAppShell({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      <AppStatusBar />
      <OfflineBanner />
      <AuthProvider>
        <ActiveMemberProvider>
          {children}
          <StartupBackgroundMonitor />
        </ActiveMemberProvider>
      </AuthProvider>
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

              <AppToastRoot />
            </QueryClientProvider>
          </FontGate>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
