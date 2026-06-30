import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { OtpInputRef } from 'react-native-otp-entry';
import { useAuth } from '@/features/auth/context/AuthContext';
import { authFeedback } from '@/features/auth/feedback/authFeedback';
import { authToast } from '@/shared/components/Toast';
import {
  AuthBackLink,
  AuthOtpInput,
  AuthScreen,
  AuthSubmitButton,
} from '@/features/auth/components/AuthExperience';
import { authRoutes } from '@/features/auth/navigation/authNavigation';
import { formatAuthError, validateEmail, validateOtpCode } from '@/features/auth/services/authValidation';
import { completeSignupActivation } from '@/features/auth/services/postSignupActivation';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const { verifySignupOtp, resendSignupOtp, configError } = useAuth();
  const { colors, typography } = useTheme();
  const otpRef = useRef<OtpInputRef>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!email || validateEmail(email)) {
      router.replace(authRoutes.register);
    }
  }, [email, router]);

  useEffect(() => {
    if (configError) {
      authToast.error('Configuration Error', configError);
    }
  }, [configError]);

  const handleVerify = useCallback(
    async (codeValue?: string) => {
      const otp = codeValue ?? code;
      const otpError = validateOtpCode(otp);
      if (otpError) {
        authToast.error('Verification Failed', otpError);
        return;
      }

      setLoading(true);
      try {
        const result = await verifySignupOtp(email, otp);
        if (result.error) {
          authToast.error('Verification Failed', result.error);
          otpRef.current?.clear();
          setCode('');
          return;
        }

        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          await completeSignupActivation(userId, email);
        }
      } catch (authError) {
        authToast.error('Verification Failed', formatAuthError(authError));
        otpRef.current?.clear();
        setCode('');
      } finally {
        setLoading(false);
      }
    },
    [code, email, verifySignupOtp],
  );

  async function handleResend() {
    setResending(true);
    try {
      const result = await resendSignupOtp(email);
      if (result.error) {
        authToast.error('Could not resend code', result.error);
        return;
      }
      authFeedback.otpResent();
      otpRef.current?.clear();
      setCode('');
      otpRef.current?.focus();
    } catch (authError) {
      authToast.error('Could not resend code', formatAuthError(authError));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthScreen
      title="Verify your email"
      subtitle={`Enter the 6-digit code we sent to ${email}.`}
      footer={<AuthBackLink href={authRoutes.register} label="Back to sign up" navigate="replace" />}
    >
      <AuthOtpInput
        ref={otpRef}
        disabled={loading || resending || Boolean(configError)}
        onChange={setCode}
        onFilled={(filledCode) => {
          setCode(filledCode);
          void handleVerify(filledCode);
        }}
      />

      <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary, textAlign: 'center' }]}>
        Didn&apos;t get it? Check spam or request a new code.
      </Text>

      <AuthSubmitButton
        label="Confirm email"
        onPress={handleVerify}
        loading={loading}
        disabled={Boolean(configError) || code.length < 6}
      />

      <AuthSubmitButton
        label={resending ? 'Sending…' : 'Resend code'}
        onPress={handleResend}
        loading={resending}
        disabled={Boolean(configError) || loading}
        variant="outline"
      />
    </AuthScreen>
  );
}
