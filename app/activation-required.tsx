import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { authToast } from '@/shared/components/Toast';
import { AuthScreen, AuthSubmitButton } from '@/features/auth/components/AuthExperience';
import {
  useActivationRequest,
  useSubmitActivationRequest,
} from '@/features/auth/hooks/useActivationRequest';
import { useTheme } from '@/shared/theme';

export default function ActivationRequiredScreen() {
  const router = useRouter();
  const { colors, typography, inset, radius, gap } = useTheme();

  const activationRequestQuery = useActivationRequest();
  const submitRequestMutation = useSubmitActivationRequest();

  const hasSubmittedRequest = Boolean(activationRequestQuery.data);

  async function handleSubmitRequest() {
    if (hasSubmittedRequest || submitRequestMutation.isPending) return;

    try {
      await submitRequestMutation.mutateAsync();
      authToast.success(
        'Request sent',
        'Our team will reach out soon or activate your account at your next visit.',
      );
    } catch {
      authToast.error('Error', 'Could not send your request. Please try again.');
    }
  }

  return (
    <AuthScreen
      title="Activation Required"
      subtitle="Your account needs to be linked to your academy membership."
      showBackButton
      onBackPress={() => router.back()}
    >
      <View style={styles.content}>
        <Text
          style={[typography.textPresets.body, { color: colors.text.secondary, marginBottom: 16 }]}
        >
          To protect your membership, 971 MMA requires verified activation. We couldn&apos;t
          automatically match your email or phone number to an active membership on file.
        </Text>
        <Text
          style={[typography.textPresets.body, { color: colors.text.secondary, marginBottom: 24 }]}
        >
          Visit the front desk to link your account, or send a request below and our team will help
          you get set up.
        </Text>
      </View>

      {hasSubmittedRequest ? (
        <View
          style={[
            styles.successCard,
            {
              backgroundColor: colors.status.successSubtle,
              borderColor: colors.status.successBorder,
              borderRadius: radius.card,
              padding: inset.md,
              gap: gap.sm,
              marginBottom: gap.md,
            },
          ]}
        >
          <View style={[styles.successHeader, { gap: gap.sm }]}>
            <CircleCheck size={22} color={colors.status.success} strokeWidth={2.25} />
            <Text
              style={[typography.textPresets.bodyStrong, { color: colors.status.success, flex: 1 }]}
            >
              Request received
            </Text>
          </View>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            Thanks — our staff will contact you soon, or activate your account when you next visit
            the academy.
          </Text>
        </View>
      ) : (
        <AuthSubmitButton
          label={submitRequestMutation.isPending ? 'Sending request…' : 'Request activation'}
          onPress={handleSubmitRequest}
          loading={submitRequestMutation.isPending}
        />
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    marginVertical: 12,
  },
  successCard: {
    borderWidth: 1,
  },
  successHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
