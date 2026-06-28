import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/shared/theme';
import type { PointsTier } from '@/types/domain';

type Props = {
  balance: number;
  tier: PointsTier;
  lifetimePoints: number;
};

function getTierDisplayName(tier: string) {
  if (tier === 'bronze') return 'Bronze';
  if (tier === 'silver') return 'Silver';
  if (tier === 'gold') return 'Gold';
  return 'Bronze';
}

export const PointsBalanceCard = memo(function PointsBalanceCard({ balance, tier, lifetimePoints }: Props) {
  const { colors, radius, gap } = useTheme();
  const tierLabel = getTierDisplayName(tier).toUpperCase();

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius.cardLarge,
          backgroundColor: colors.surface.promo,
          borderColor: colors.border.onPromo,
          marginBottom: gap.lg,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.kickerRow, { gap: gap.xs }]}>
          <Ionicons name="server-outline" size={14} color={colors.accent.default} />
          <Text style={[styles.kicker, { color: colors.text.onPromoMuted }]}>POINTS BALANCE</Text>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: colors.accent.default }]}>
          <Text style={[styles.tierBadgeText, { color: colors.accent.onAccent }]}>{tierLabel}</Text>
        </View>
      </View>

      <Text style={[styles.balance, { color: colors.text.onPromo }]}>{balance.toLocaleString('en-US')}</Text>
      <Text style={[styles.lifetime, { color: colors.text.onPromoMuted }]}>
        {lifetimePoints.toLocaleString('en-US')} lifetime
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  kickerRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  tierBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tierBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  balance: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
    marginTop: 10,
  },
  lifetime: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 2,
  },
});
