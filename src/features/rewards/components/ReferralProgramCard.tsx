import React, { memo, useCallback, useMemo } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/shared/components/ui';
import { toast } from '@/shared/components/Toast';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { REFERRAL_BONUS_POINTS } from '@/services/database/referrals.repository';

type Props = {
  referralCode: string | null;
  isLoadingCode?: boolean;
  /** Hide inner promo hero when the screen already shows a title. */
  compact?: boolean;
};

export const ReferralProgramCard = memo(function ReferralProgramCard({
  referralCode,
  isLoadingCode = false,
  compact = false,
}: Props) {
  const { colors, typography, radius, gap, layout, shadows } = useTheme();

  const shareMessage = useMemo(() => {
    if (!referralCode) return '';
    return `Join me at 971 MMA! Use my referral code ${referralCode} when you sign up. We both earn ${REFERRAL_BONUS_POINTS} points after your account is activated.`;
  }, [referralCode]);

  const handleShare = useCallback(async () => {
    if (!referralCode) return;
    triggerLightImpact();
    try {
      await Share.share({ message: shareMessage });
    } catch {
      toast.error('Share failed', 'Could not open the share sheet.');
    }
  }, [referralCode, shareMessage]);

  const handleCopyCode = useCallback(async () => {
    if (!referralCode) return;
    triggerLightImpact();
    try {
      await Share.share({ message: referralCode });
      triggerSuccessNotification();
      toast.success('Code ready', 'Share or paste your referral code.');
    } catch {
      toast.error('Copy failed', 'Could not share your referral code.');
    }
  }, [referralCode]);

  return (
    <View
      style={[
        styles.card,
        shadows.card,
        {
          backgroundColor: colors.surface.primary,
          borderColor: colors.border.subtle,
          borderRadius: radius.cardLarge,
          borderWidth: layout.borderWidth,
          marginBottom: compact ? 0 : gap.lg,
          gap: gap.md,
        },
      ]}
    >
      {!compact ? (
        <View style={[styles.hero, { backgroundColor: colors.surface.promo, borderRadius: radius.card }]}>
          <View style={styles.heroHeader}>
            <Ionicons name="people-outline" size={18} color={colors.accent.default} />
            <Text style={[styles.heroKicker, { color: colors.text.onPromoMuted }]}>REFER A FRIEND</Text>
          </View>
          <Text style={[typography.textPresets.title, { color: colors.text.onPromo }]}>
            You both earn {REFERRAL_BONUS_POINTS.toLocaleString('en-US')} points
          </Text>
          <Text style={[typography.textPresets.footnote, { color: colors.text.onPromoMuted }]}>
            Share your code with a friend who is not on 971 MMA yet. When they activate their account, you both get the bonus.
          </Text>
        </View>
      ) : (
        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
          Share your code with a friend who is not on 971 MMA yet. When they activate their account, you both earn{' '}
          {REFERRAL_BONUS_POINTS.toLocaleString('en-US')} points.
        </Text>
      )}

      <View style={[styles.codeCard, { backgroundColor: colors.fill.secondary, borderRadius: radius.card }]}>
        <Text style={[typography.textPresets.label, { color: colors.text.secondary }]}>YOUR CODE</Text>
        <Text style={[typography.textPresets.hero, { color: colors.text.primary, letterSpacing: 4 }]}>
          {isLoadingCode ? '••••••' : referralCode ?? '------'}
        </Text>
      </View>

      <View style={{ gap: gap.sm }}>
        <Button label="Share code" onPress={handleShare} disabled={!referralCode || isLoadingCode} full />
        <Button
          label="Copy code"
          variant="outline"
          onPress={handleCopyCode}
          disabled={!referralCode || isLoadingCode}
          full
        />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 16,
  },
  hero: {
    gap: 6,
    padding: 16,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  codeCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
  },
});
