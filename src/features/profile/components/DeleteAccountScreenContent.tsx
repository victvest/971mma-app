import React, { useCallback, useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleSheet, Text } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldAlert, Trash2 } from 'lucide-react-native';

import { useAuth } from '@/features/auth/context/AuthContext';
import { AuthSubmitButton, AuthTextField } from '@/features/auth/components/AuthExperience';
import { toast } from '@/shared/components/Toast';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { deleteMyAccount } from '@/services/database/account.repository';

const CONFIRM_WORD = 'DELETE';

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

export function DeleteAccountScreenContent() {
  const { colors, typography, inset, gap } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();

  const [confirmText, setConfirmText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = confirmText === CONFIRM_WORD && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    triggerLightImpact();
    Keyboard.dismiss();
    setSubmitting(true);
    try {
      await deleteMyAccount();
      await signOut();
      toast.success(
        'Account deleted',
        'Your app account and personal data have been permanently removed.',
      );
      router.replace('/(auth)/login');
    } catch {
      toast.error(
        'Could not delete account',
        'Please try again or contact info@971mma.com if this keeps happening.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, router, signOut]);

  const introStyle = useEntrance(0);
  const fieldStyle = useEntrance(80);
  const barStyle = useEntrance(160);

  return (
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
        <Animated.View style={introStyle}>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            This permanently deletes your 971 MMA app account, profile, attendance history, belt
            progress, and points. Deletion completes immediately when you confirm below. Gym
            membership and billing are separate — contact the front desk at info@971mma.com or +971
            54 332 3980 to cancel those.
          </Text>
        </Animated.View>

        <Animated.View style={fieldStyle}>
          <AuthTextField
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={CONFIRM_WORD}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            icon={ShieldAlert}
            returnKeyType="done"
            onSubmitEditing={canSubmit ? handleSubmit : undefined}
          />
        </Animated.View>
      </Animated.ScrollView>

      <Animated.View
        style={[
          styles.submitBar,
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
          label="Delete my account"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
          icon={Trash2}
          variant="danger"
        />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  submitBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
