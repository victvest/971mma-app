import React, { memo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '@/shared/theme';
import { GATE_QR_REFRESH_SECONDS } from '@/features/gate/hooks/useGateQr';

function GateRefreshCountdownComponent() {
  const { colors, typography } = useTheme();

  return (
    <Text style={[typography.textPresets.footnote, styles.label, { color: colors.text.onPromoMuted }]}>
      Updates every {GATE_QR_REFRESH_SECONDS}s
    </Text>
  );
}

export const GateRefreshCountdown = memo(GateRefreshCountdownComponent);

const styles = StyleSheet.create({
  label: {
    textAlign: 'center',
  },
});
