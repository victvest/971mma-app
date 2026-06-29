import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/theme';
import { triggerLightImpact } from '@/shared/haptics';

const ON_INVERSE = {
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.55)',
  subtle: 'rgba(255,255,255,0.45)',
  surface: 'rgba(255,255,255,0.08)',
  surfaceStrong: 'rgba(255,255,255,0.14)',
} as const;

type Props = {
  token: string | null | undefined;
  loading: boolean;
  checkedInToday: boolean;
  memberName: string;
  beltLine: string;
  /** Plan name from active membership (e.g. "BJJ Unlimited"). */
  planName?: string | null;
  /** Membership expiry date, formatted (e.g. "Expires 31 Aug 2025"). */
  expiryDate?: string | null;
  isGuest?: boolean;
  isRegistered?: boolean;
};

export function QrPassCard({
  token,
  loading,
  checkedInToday,
  memberName,
  beltLine,
  planName,
  expiryDate,
  isGuest = false,
  isRegistered = false,
}: Props) {
  const { colors, typography, inset, radii, radius, gap } = useTheme();
  const router = useRouter();

  const handleUnlockPress = () => {
    triggerLightImpact();
    if (isRegistered) {
      router.push('/activation-required');
    } else {
      router.push('/(auth)/register');
    }
  };

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Digital membership card for ${memberName}. ${planName ?? 'Active member'}.`}
      style={[
        styles.card,
        {
          borderRadius: radius.cardLarge,
          backgroundColor: colors.background.inverse,
          padding: inset.lg,
          paddingTop: inset.lg,
          gap: gap.lg,
          borderColor: colors.border.onPromo,
          borderWidth: 1,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusPill,
            {
              borderRadius: radius.pill,
              backgroundColor: checkedInToday ? colors.status.success + '22' : colors.accent.default + '22',
            },
          ]}
        >
          <View
            style={[
              styles.liveDot,
              {
                backgroundColor: checkedInToday ? colors.status.success : colors.accent.default,
              },
            ]}
          />
          <Text
            style={[
              styles.pillLabel,
              {
                color: checkedInToday ? colors.status.success : colors.accent.default,
              },
            ]}
          >
            {checkedInToday ? 'CHECKED IN TODAY' : 'MEMBER CARD'}
          </Text>
        </View>

        {/* Identity — not gate access */}
        <View
          style={[
            styles.identityPill,
            { borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.10)' },
          ]}
        >
          <Text style={[styles.pillLabel, { color: ON_INVERSE.muted }]}>
            971 MMA
          </Text>
        </View>
      </View>

      <View style={styles.qrWrap}>
        {isGuest ? (
          <View style={[styles.qrFrame, { borderRadius: radii.lg, overflow: 'hidden', position: 'relative' }]}>
            <QRCode value="guest-token" size={208} backgroundColor="#FFFFFF" color="#000000" />
            <View style={[StyleSheet.absoluteFill, styles.qrLockOverlay]}>
              <BlurView intensity={35} tint="light" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.45)' }]} />
              <Pressable onPress={handleUnlockPress}>
                <Ionicons name="lock-closed" size={32} color={colors.accent.default} />
              </Pressable>
            </View>
          </View>
        ) : loading ? (
          <View style={[styles.qrFrame, { borderRadius: radii.lg }]}>
            <View style={styles.qrLoadingBox}>
              <ActivityIndicator size="large" color={colors.accent.default} />
            </View>
          </View>
        ) : token ? (
          <View style={[styles.qrFrame, { borderRadius: radii.lg }]}>
            <QRCode value={token} size={208} backgroundColor="#FFFFFF" color="#000000" />
          </View>
        ) : (
          <View style={[styles.qrPlaceholder, { borderRadius: radii.lg }]}>
            <Ionicons name="qr-code-outline" size={48} color="rgba(255,255,255,0.35)" />
            <Text style={styles.errorLabel}>Unable to load card</Text>
          </View>
        )}
      </View>

      <View style={[styles.memberBlock, { gap: gap.xs }]}>
        <Text style={[typography.textPresets.metricLabel, { color: ON_INVERSE.subtle }]}>
          {planName ?? 'Member · 971 MMA'}
        </Text>
        <Text style={[styles.memberName, { color: ON_INVERSE.text }]} numberOfLines={1}>
          {memberName}
        </Text>
        {beltLine ? (
          <Text style={[styles.beltLine, { color: ON_INVERSE.muted }]} numberOfLines={2}>
            {beltLine}
          </Text>
        ) : null}
        {expiryDate ? (
          <Text style={[styles.expiryLine, { color: ON_INVERSE.subtle }]} numberOfLines={1}>
            {expiryDate}
          </Text>
        ) : null}
      </View>

      {isGuest && (
        <Pressable
          onPress={handleUnlockPress}
          style={({ pressed }) => [
            styles.unlockBtn,
            {
              borderRadius: radius.button,
              backgroundColor: colors.accent.default,
              opacity: pressed ? 0.88 : 1,
              paddingVertical: 16,
              alignItems: 'center',
            },
          ]}
        >
          <Text style={[typography.textPresets.buttonSmall, { color: '#FFFFFF' }]}>
            {isRegistered ? 'Link Membership' : 'Sign Up to Unlock'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    position: 'relative',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  identityPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  qrWrap: {
    alignItems: 'center',
  },
  qrFrame: {
    padding: 18,
    backgroundColor: '#FFFFFF',
  },
  qrLoadingBox: {
    alignItems: 'center',
    height: 208,
    justifyContent: 'center',
    width: 208,
  },
  qrPlaceholder: {
    width: 244,
    height: 244,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  memberBlock: {
    alignItems: 'center',
  },
  memberName: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 0,
    textAlign: 'center',
  },
  beltLine: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '500',
  },
  expiryLine: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 2,
  },
  qrLockOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
