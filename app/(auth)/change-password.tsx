import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Lock, ShieldCheck } from 'lucide-react-native';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  AuthScreen,
  AuthSubmitButton,
  AuthTextField,
} from '@/features/auth/components/AuthExperience';
import { authFeedback } from '@/features/auth/feedback/authFeedback';
import { authRoutes } from '@/features/auth/navigation/authNavigation';
import { formatAuthError, validatePasswordConfirmation } from '@/features/auth/services/authValidation';
import { authToast } from '@/shared/components/Toast';

export default function ChangePasswordScreen() {
  const { updatePassword, signOut, configError, passwordRecoveryActive } = useAuth();
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (configError) {
      authToast.error('Configuration Error', configError);
    }
  }, [configError]);

  function focusConfirmPasswordField() {
    confirmPasswordRef.current?.focus();
  }

  function showPasswordError(message: string) {
    Keyboard.dismiss();
    authToast.error('Password update failed', message);
  }

  async function handleUpdatePassword() {
    const passwordError = validatePasswordConfirmation(password, confirmPassword);
    if (passwordError) {
      showPasswordError(passwordError);
      return;
    }

    setLoading(true);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        showPasswordError(result.error);
        return;
      }

      Keyboard.dismiss();
      await signOut();
      router.replace(authRoutes.login);
      authFeedback.passwordReset();
    } catch (authError) {
      showPasswordError(formatAuthError(authError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen
      title="Set a new password"
      subtitle={
        passwordRecoveryActive
          ? 'Choose a new password for your account.'
          : 'Choose a secure password to continue.'
      }
    >
      <AuthTextField
        ref={passwordRef}
        label="New password"
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
        placeholder="Repeat new password"
        icon={ShieldCheck}
        returnKeyType="done"
        onSubmitEditing={handleUpdatePassword}
      />

      <AuthSubmitButton
        label="Update password"
        onPress={handleUpdatePassword}
        loading={loading}
        disabled={Boolean(configError)}
        icon={Check}
      />
    </AuthScreen>
  );
}
