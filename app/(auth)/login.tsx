import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { TextInput } from 'react-native';
import { Lock, Mail } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/context/AuthContext';
import { authToast } from '@/shared/components/Toast';
import {
  AuthGoogleButton,
  AuthFooterPrompt,
  AuthLink,
  AuthOrDivider,
  AuthScreen,
  AuthSubmitButton,
  AuthTextField,
} from '@/features/auth/components/AuthExperience';
import { formatAuthError, validateEmail } from '@/features/auth/services/authValidation';
import { authRoutes } from '@/features/auth/navigation/authNavigation';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, configError } = useAuth();
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  async function handleSignIn() {
    const emailError = validateEmail(email);
    if (emailError) {
      authToast.error('Sign In Failed', emailError);
      emailRef.current?.focus();
      return;
    }

    if (!password) {
      authToast.error('Sign In Failed', 'Enter your password.');
      passwordRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        authToast.error('Sign In Failed', result.error);
        if (result.error.toLowerCase().includes('password')) {
          passwordRef.current?.focus();
        } else if (result.error.toLowerCase().includes('email')) {
          emailRef.current?.focus();
        }
        return;
      }
    } catch (authError) {
      authToast.error('Sign In Failed', formatAuthError(authError));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.cancelled) return;
      if (result.recovery) return;
      if (result.error) {
        authToast.error('Google Sign In Failed', result.error);
      }
    } catch (authError) {
      authToast.error('Google Sign In Failed', formatAuthError(authError));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Sign in to your account."
      showBackButton
      onBackPress={handleBack}
      footer={
        <AuthFooterPrompt
          prompt="New here?"
          href={authRoutes.register}
          actionLabel="Create account"
        />
      }
    >
      <AuthGoogleButton
        onPress={handleGoogleSignIn}
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
        autoComplete="password"
        textContentType="password"
        placeholder="Your password"
        icon={Lock}
        returnKeyType="done"
        onSubmitEditing={handleSignIn}
      />

      <AuthSubmitButton
        label="Sign in"
        onPress={handleSignIn}
        loading={loading}
        disabled={Boolean(configError) || googleLoading}
      />

      <View style={{ alignItems: 'center' }}>
        <AuthLink href={authRoutes.forgotPassword} label="Forgot password?" navigate="push" />
      </View>
    </AuthScreen>
  );
}
