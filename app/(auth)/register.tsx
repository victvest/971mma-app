import React, { useEffect, useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, Mail, Ticket } from 'lucide-react-native';
import { setPendingReferralCode } from '@/features/auth/services/referralCodeStorage';
import { useAuth } from '@/features/auth/context/AuthContext';
import { authFeedback } from '@/features/auth/feedback/authFeedback';
import { authToast } from '@/shared/components/Toast';
import {
  AuthGoogleButton,
  AuthOrDivider,
  AuthScreen,
  AuthFooterPrompt,
  AuthSubmitButton,
  AuthTextField,
} from '@/features/auth/components/AuthExperience';
import { authRoutes } from '@/features/auth/navigation/authNavigation';
import {
  formatAuthError,
  normalizeEmail,
  validateEmail,
  validatePasswordConfirmation,
} from '@/features/auth/services/authValidation';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, signUpWithGoogle, configError } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (configError) {
      authToast.error('Configuration Error', configError);
    }
  }, [configError]);

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(authRoutes.intro);
  }

  function focusPasswordField() {
    passwordRef.current?.focus();
  }

  function focusConfirmPasswordField() {
    confirmPasswordRef.current?.focus();
  }

  async function handleSignUp() {
    const emailError = validateEmail(email);
    if (emailError) {
      authToast.error('Registration Failed', emailError);
      emailRef.current?.focus();
      return;
    }

    const passwordError = validatePasswordConfirmation(password, confirmPassword);
    if (passwordError) {
      authToast.error('Registration Failed', passwordError);
      if (passwordError.includes('match') || passwordError.includes('Confirm')) {
        confirmPasswordRef.current?.focus();
      } else {
        passwordRef.current?.focus();
      }
      return;
    }

    setLoading(true);
    try {
      await setPendingReferralCode(referralCode);
      const result = await signUp(email, password);

      if (result.error) {
        authToast.error('Registration Failed', result.error);
        if (result.error.toLowerCase().includes('already exists')) {
          emailRef.current?.focus();
        }
        return;
      }

      const normalizedEmail = result.email ?? normalizeEmail(email);
      authFeedback.otpSent();
      router.push({
        pathname: authRoutes.verifyEmail,
        params: { email: normalizedEmail },
      });
    } catch (authError) {
      authToast.error('Registration Failed', formatAuthError(authError));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    try {
      await setPendingReferralCode(referralCode);
      const result = await signUpWithGoogle();
      if (result.cancelled) return;
      if (result.recovery) return;
      if (result.error) {
        authToast.error('Google Sign Up Failed', result.error);
      }
    } catch (authError) {
      authToast.error('Google Sign Up Failed', formatAuthError(authError));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Create account"
      subtitle="Set up your account. We'll send a code to confirm your email."
      showBackButton
      onBackPress={handleBack}
      footer={
        <AuthFooterPrompt
          prompt="Already have an account?"
          href={authRoutes.login}
          actionLabel="Sign in"
        />
      }
    >
      <AuthGoogleButton
        onPress={handleGoogleSignUp}
        loading={googleLoading}
        disabled={Boolean(configError) || loading}
      />

      <AuthOrDivider />

      <AuthTextField
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
        icon={Mail}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={focusPasswordField}
        onDomainSuggestionApplied={focusPasswordField}
      />

      <AuthTextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        password
        showPasswordRules
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Letters and numbers"
        icon={Lock}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={focusConfirmPasswordField}
      />

      <AuthTextField
        ref={confirmPasswordRef}
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        password
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Repeat your password"
        icon={Lock}
        returnKeyType="next"
        blurOnSubmit={false}
        onSubmitEditing={() => {}}
      />

      <AuthTextField
        label="Referral code (optional)"
        value={referralCode}
        onChangeText={setReferralCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="Friend's code"
        icon={Ticket}
        returnKeyType="done"
        onSubmitEditing={handleSignUp}
      />

      <AuthSubmitButton
        label="Continue"
        onPress={handleSignUp}
        loading={loading}
        disabled={Boolean(configError) || googleLoading}
      />
    </AuthScreen>
  );
}
