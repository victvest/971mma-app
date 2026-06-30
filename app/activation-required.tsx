import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck } from 'lucide-react-native';
import { authToast } from '@/shared/components/Toast';
import { AuthScreen, AuthSubmitButton, AuthTextField } from '@/features/auth/components/AuthExperience';
import {
  useActivationRequest,
  useSubmitActivationRequest,
} from '@/features/auth/hooks/useActivationRequest';
import {
  useApplyReferralCode,
  useReferralStatus,
} from '@/features/rewards/hooks/useReferrals';
import { useTheme } from '@/shared/theme';
import { Ticket } from 'lucide-react-native';

export default function ActivationRequiredScreen() {
  const router = useRouter();
  const { colors, typography, inset, radius, gap } = useTheme();

  const activationRequestQuery = useActivationRequest();
  const submitRequestMutation = useSubmitActivationRequest();
  const referralStatusQuery = useReferralStatus();
  const applyReferralMutation = useApplyReferralCode();
  const [referralCode, setReferralCode] = useState('');

  const hasSubmittedRequest = Boolean(activationRequestQuery.data);
  const referralApplied = Boolean(referralStatusQuery.data?.applied);

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

  async function handleApplyReferralCode() {
    const code = referralCode.trim();
    if (!code || applyReferralMutation.isPending || referralApplied) return;

    try {
      await applyReferralMutation.mutateAsync(code);
      authToast.success(
        'Code saved',
        'You and your friend will earn bonus points once your account is activated.',
      );
      setReferralCode('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not apply this code.';
      if (message.includes('INVALID_CODE')) {
        authToast.error('Invalid code', 'Check the code and try again.');
        return;
      }
      if (message.includes('ALREADY_REFERRED')) {
        authToast.error('Code already used', 'A referral is already linked to your account.');
        return;
      }
      if (message.includes('ALREADY_ACTIVE')) {
        authToast.error('Account active', 'Referral codes can only be used before activation.');
        return;
      }
      if (message.includes('SELF_REFERRAL')) {
        authToast.error('Invalid code', 'You cannot use your own referral code.');
        return;
      }
      authToast.error('Referral failed', message);
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
        <Text style={[typography.textPresets.body, { color: colors.text.secondary, marginBottom: 16 }]}>
          To protect your membership, 971 MMA requires verified activation. We couldn&apos;t automatically match your email or phone number to an active membership on file.
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary, marginBottom: 24 }]}>
          Visit the front desk to link your account, or send a request below and our team will help you get set up.
        </Text>
      </View>

      {referralApplied ? (
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
            <Text style={[typography.textPresets.bodyStrong, { color: colors.status.success, flex: 1 }]}>
              Referral code linked
            </Text>
          </View>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {referralStatusQuery.data?.referrerName
              ? `${referralStatusQuery.data.referrerName}'s code is saved. `
              : ''}
            Bonus points unlock for both of you when your account activates.
          </Text>
        </View>
      ) : (
        <View style={{ marginBottom: gap.md, gap: gap.sm }}>
          <AuthTextField
            label="Have a referral code?"
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Enter friend's code"
            icon={Ticket}
            returnKeyType="done"
            onSubmitEditing={handleApplyReferralCode}
          />
          <AuthSubmitButton
            label={applyReferralMutation.isPending ? 'Saving code…' : 'Apply referral code'}
            onPress={handleApplyReferralCode}
            loading={applyReferralMutation.isPending}
            disabled={!referralCode.trim()}
            variant="outline"
          />
        </View>
      )}

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
            <Text style={[typography.textPresets.bodyStrong, { color: colors.status.success, flex: 1 }]}>
              Request received
            </Text>
          </View>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            Thanks — our staff will contact you soon, or activate your account when you next visit the academy.
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
