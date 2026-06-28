import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Lock, ShieldCheck } from 'lucide-react-native';

import { AppBar } from '@/shared/components/ui';
import { authToast } from '@/shared/components/Toast';
import { useTheme } from '@/shared/theme';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  AuthSubmitButton,
  AuthTextField,
} from '@/features/auth/components/AuthExperience';
import {
  formatAuthError,
  isPasswordValid,
  validatePasswordConfirmation,
} from '@/features/auth/services/authValidation';

// ─── Entrance animation hook ──────────────────────────────────────────────────
function useEntrance(delayMs: number) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(28);

  useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      delayMs,
      withSpring(0, { damping: 24, stiffness: 220, mass: 0.85 }),
    );
    // stable refs — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function ChangePasswordScreen() {
  const { colors, inset, gap } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const { signIn, updatePassword, configError } = useAuth();
  const userEmail = useAuthStore((s) => s.user?.email);

  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (configError) {
      authToast.error('Configuration Error', configError);
    }
  }, [configError]);

  const canSubmit = useMemo(
    () =>
      current.trim().length > 0 &&
      isPasswordValid(next) &&
      confirm.length > 0 &&
      next === confirm,
    [current, next, confirm],
  );

  const showPasswordError = useCallback((message: string) => {
    Keyboard.dismiss();
    authToast.error('Password update failed', message);
  }, []);

  const handleSave = useCallback(async () => {
    if (!current.trim()) {
      showPasswordError('Enter your current password.');
      return;
    }

    const passwordError = validatePasswordConfirmation(next, confirm);
    if (passwordError) {
      showPasswordError(passwordError);
      return;
    }

    if (!userEmail) {
      showPasswordError('Please sign out and back in.');
      return;
    }

    setSaving(true);
    try {
      const authResult = await signIn(userEmail, current);
      if (authResult.error) {
        showPasswordError('Current password is incorrect.');
        return;
      }

      const updateResult = await updatePassword(next);
      if (updateResult.error) {
        showPasswordError(updateResult.error);
        return;
      }

      Keyboard.dismiss();
      authToast.success('Password updated', 'Your new password is active.');
    } catch (error) {
      showPasswordError(formatAuthError(error));
    } finally {
      setSaving(false);
    }
  }, [current, next, confirm, userEmail, signIn, updatePassword, showPasswordError]);

  const field1Style = useEntrance(0);
  const field2Style = useEntrance(80);
  const field3Style = useEntrance(150);
  const barStyle = useEntrance(220);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background.primary }]} edges={['top']}>
      <AppBar title="Change Password" showBackButton />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        <Animated.ScrollView
          style={styles.flex}
          contentContainerStyle={{
            paddingHorizontal: inset.lg,
            paddingTop: inset.lg,
            paddingBottom: inset['3xl'],
            gap: gap.lg,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={field1Style}>
            <AuthTextField
              label="Current password"
              value={current}
              onChangeText={setCurrent}
              placeholder="Your current password"
              password
              autoComplete="current-password"
              textContentType="password"
              icon={Lock}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => nextRef.current?.focus()}
            />
          </Animated.View>

          <Animated.View style={field2Style}>
            <AuthTextField
              ref={nextRef}
              label="New password"
              value={next}
              onChangeText={setNext}
              placeholder="Letters and numbers"
              password
              showPasswordRules
              autoComplete="new-password"
              textContentType="newPassword"
              icon={Lock}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => confirmRef.current?.focus()}
            />
          </Animated.View>

          <Animated.View style={field3Style}>
            <AuthTextField
              ref={confirmRef}
              label="Confirm new password"
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Repeat new password"
              password
              autoComplete="new-password"
              textContentType="newPassword"
              icon={ShieldCheck}
              returnKeyType="done"
              onSubmitEditing={canSubmit ? handleSave : undefined}
            />
          </Animated.View>
        </Animated.ScrollView>

        <Animated.View
          style={[
            styles.saveBar,
            {
              backgroundColor: colors.background.primary,
              borderTopColor: colors.border.subtle,
              paddingHorizontal: inset.lg,
              paddingTop: inset.md,
              paddingBottom: safeInsets.bottom + inset.md,
            },
            barStyle,
          ]}
        >
          <AuthSubmitButton
            label="Update password"
            onPress={handleSave}
            loading={saving}
            disabled={!canSubmit || Boolean(configError)}
            icon={Check}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  saveBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
