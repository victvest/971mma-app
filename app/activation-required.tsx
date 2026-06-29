import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/features/auth/context/AuthContext';
import { useAuthStore } from '@/stores/useAuthStore';
import { authToast } from '@/shared/components/Toast';
import { AuthScreen, AuthSubmitButton } from '@/features/auth/components/AuthExperience';
import { ensureMindbodyLink } from '@/features/auth/services/linkMindbody';
import { applyProfileAuthInfo } from '@/features/auth/services/authProfileSync';
import { useTheme } from '@/shared/theme';

export default function ActivationRequiredScreen() {
  const { signOut, user } = useAuth();
  const { colors, typography } = useTheme();
  const [checking, setChecking] = useState(false);

  async function handleCheckActivation() {
    if (!user?.id) return;
    setChecking(true);
    try {
      try {
        await ensureMindbodyLink();
      } catch {
        // Fall through to profile status check.
      }

      const refreshed = await applyProfileAuthInfo(user.id, user.email ?? '');
      if (!refreshed) {
        authToast.error('Error', 'Unable to check activation status. Please try again.');
        return;
      }

      const accountStatus = useAuthStore.getState().user?.accountStatus;
      if (accountStatus === 'active') {
        authToast.success('Activated!', 'Your account has been successfully activated.');
      } else {
        authToast.error(
          'Not Active Yet',
          'Your account is still pending activation. Please contact the front desk.',
        );
      }
    } catch {
      authToast.error('Error', 'Unable to check activation status. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <AuthScreen
      title="Activation Required"
      subtitle="Your account needs to be linked to your academy membership."
    >
      <View style={styles.content}>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary, marginBottom: 16 }]}>
          To protect your membership, 971 MMA requires verified activation. We couldn&apos;t automatically match your email or phone number to an active Mindbody client.
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary, marginBottom: 24 }]}>
          Please visit the front desk at the academy to manually link your account. Once the staff has completed the link, tap the button below.
        </Text>
      </View>

      <AuthSubmitButton
        label={checking ? 'Checking Status…' : 'Check Activation Status'}
        onPress={handleCheckActivation}
        loading={checking}
      />

      <AuthSubmitButton
        label="Sign Out"
        onPress={signOut}
        variant="outline"
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    marginVertical: 12,
  },
});
