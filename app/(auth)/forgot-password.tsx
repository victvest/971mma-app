import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Mail, Send } from 'lucide-react-native';
import { useAuth } from '@/features/auth/context/AuthContext';
import { authToast } from '@/shared/components/Toast';
import {
  AuthBackLink,
  AuthScreen,
  AuthSubmitButton,
  AuthTextField,
} from '@/features/auth/components/AuthExperience';
import { authFeedback } from '@/features/auth/feedback/authFeedback';
import { authRoutes } from '@/features/auth/navigation/authNavigation';
import { formatAuthError, normalizeEmail, validateEmail } from '@/features/auth/services/authValidation';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { sendRecoveryOtp, configError } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (configError) {
      authToast.error('Configuration Error', configError);
    }
  }, [configError]);

  async function handleSendCode() {
    const emailError = validateEmail(email);
    if (emailError) {
      authToast.error('Reset Failed', emailError);
      return;
    }

    setLoading(true);
    try {
      const result = await sendRecoveryOtp(email);
      if (result.error) {
        authToast.error('Reset Failed', result.error);
        return;
      }

      authFeedback.otpSent();
      router.push({
        pathname: authRoutes.resetVerifyOtp,
        params: { email: result.email ?? normalizeEmail(email) },
      });
    } catch (authError) {
      authToast.error('Reset Failed', formatAuthError(authError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Reset password"
      subtitle="Enter your email and we'll send a 6-digit code to verify it's you."
      footer={<AuthBackLink href={authRoutes.login} label="Back to sign in" navigate="back" />}
    >
      <AuthTextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
        icon={Mail}
        returnKeyType="done"
        onSubmitEditing={handleSendCode}
      />

      <AuthSubmitButton
        label="Send code"
        onPress={handleSendCode}
        loading={loading}
        disabled={Boolean(configError)}
        icon={Send}
      />
    </AuthScreen>
  );
}
