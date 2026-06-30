import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import {
  AuthScreen,
  AuthSubmitButton,
} from '@/features/auth/components/AuthExperience';
import {
  handleAuthDeepLink,
  routeAuthDeepLinkOutcome,
} from '@/features/auth/services/authDeepLinkHandler';
import { isAuthCallbackUrl } from '@/features/auth/services/authRedirect';
import { authRoutes } from '@/features/auth/navigation/authNavigation';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useTheme } from '@/shared/theme';

export default function AuthCallbackScreen() {
  const url = Linking.useURL();
  const router = useRouter();
  const { colors } = useTheme();
  const { beginPasswordRecovery } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const handledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url || !isAuthCallbackUrl(url)) return;
    if (handledUrlRef.current === url) return;

    handledUrlRef.current = url;
    void (async () => {
      const outcome = await handleAuthDeepLink(url);
      if (outcome.kind === 'error') {
        setErrorMessage(outcome.message);
      }

      await routeAuthDeepLinkOutcome(outcome, router.replace, () => {
        beginPasswordRecovery();
      });
    })();
  }, [beginPasswordRecovery, router, url]);

  if (errorMessage) {
    return (
      <AuthScreen
        title="Authentication failed"
        subtitle={errorMessage}
        footer={
          <AuthSubmitButton
            label="Back to sign in"
            onPress={() => router.replace(authRoutes.login)}
          />
        }
      >
        <View />
      </AuthScreen>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background.primary,
      }}
    >
      <ActivityIndicator size="large" color={colors.accent.default} />
    </View>
  );
}
