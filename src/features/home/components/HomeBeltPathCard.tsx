import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { AnimatedProgressRing } from '@/shared/animations';
import { UaeFlagMark } from '@/shared/components/brand';
import { HomeAnimatedPressable } from '@/features/home/components/HomeAnimatedPressable';
import { HomeCommandCard } from '@/features/home/components/HomeCommandCard';
import { useTheme } from '@/shared/theme';

type Props = {
  hasBeltProgress: boolean;
  formattedBeltRank: string;
  progressStripe: number;
  stripeProgressPercent: number;
  sessionsToNext: number;
  nextStripeNum: number;
  onPress: () => void;
};

export const HomeBeltPathCard = memo(function HomeBeltPathCard({
  hasBeltProgress,
  formattedBeltRank,
  progressStripe,
  stripeProgressPercent,
  sessionsToNext,
  nextStripeNum,
  onPress,
}: Props) {
  const { colors, typography } = useTheme();

  return (
    <HomeAnimatedPressable
      onPress={onPress}
      accessibilityLabel="Open belt path progression"
    >
      <HomeCommandCard>
        <View style={styles.main}>
          <View style={styles.copy}>
            <View style={styles.kickerRow}>
              <UaeFlagMark />
              <Text style={[typography.textPresets.label, { color: colors.text.onPromoLabel }]}>
                Belt path
              </Text>
            </View>
            <Text style={[typography.textPresets.title, { color: colors.text.onPromo }]}>
              {hasBeltProgress
                ? `${formattedBeltRank} · Stripe ${progressStripe}`
                : 'Curriculum pending'}
            </Text>
            <Text style={[typography.textPresets.footnote, { color: colors.text.onPromoMuted }]}>
              {hasBeltProgress
                ? `${sessionsToNext} ${sessionsToNext === 1 ? 'session' : 'sessions'} to stripe ${nextStripeNum}`
                : 'No stripe progress tracked yet'}
            </Text>
          </View>

          <View style={styles.trailing}>
            <AnimatedProgressRing
              size={56}
              strokeWidth={3}
              percent={stripeProgressPercent}
              trackColor={colors.border.promoRing}
              progressColor={colors.accent.default}
            >
              <Text style={[typography.textPresets.captionMedium, { color: colors.text.onPromo }]}>
                {stripeProgressPercent}%
              </Text>
            </AnimatedProgressRing>
            <ChevronRight size={18} color={colors.text.onPromoMuted} strokeWidth={2.25} />
          </View>
        </View>
      </HomeCommandCard>
    </HomeAnimatedPressable>
  );
});

const styles = StyleSheet.create({
  main: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  copy: {
    flex: 1,
    gap: 6,
  },
  kickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});
