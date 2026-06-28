import React, { memo } from 'react';
import { ActivityIndicator, StyleSheet, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@/shared/theme';

type Props = {
  token: string | null | undefined;
  loading: boolean;
};

const QR_PADDING = 18;
const QR_MIN_SIZE = 208;
const QR_MAX_SIZE = 320;
const FRAME_RATIO = 0.62;

function GateQrFrameComponent({ token, loading }: Props) {
  const { colors, radii } = useTheme();
  const { width, height } = useWindowDimensions();
  const shortestEdge = Math.min(width, height);
  const qrSize = Math.round(
    Math.min(QR_MAX_SIZE, Math.max(QR_MIN_SIZE, shortestEdge * FRAME_RATIO - QR_PADDING * 2)),
  );

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Entrance check-in code, refreshes every 20 seconds"
      style={styles.wrap}
    >
      <View
        style={[
          styles.qrFrame,
          {
            borderRadius: radii.lg,
            padding: QR_PADDING,
          },
        ]}
      >
        {loading ? (
          <View style={[styles.loadingBox, { width: qrSize, height: qrSize }]}>
            <ActivityIndicator size="large" color={colors.accent.default} />
          </View>
        ) : token ? (
          <QRCode value={token} size={qrSize} backgroundColor="#FFFFFF" color="#000000" />
        ) : (
          <View style={[styles.loadingBox, { width: qrSize, height: qrSize }]} />
        )}
      </View>
    </View>
  );
}

export const GateQrFrame = memo(GateQrFrameComponent);

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrFrame: {
    backgroundColor: '#FFFFFF',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
