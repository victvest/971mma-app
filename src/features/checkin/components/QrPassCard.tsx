import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/theme';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { triggerLightImpact } from '@/shared/haptics';
import { useAuthStore } from '@/stores/useAuthStore';

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
  /** Membership expiry date, formatted (e.g. "Expires 31 Aug 2025"). */
  expiryDate?: string | null;
  expiryLoading?: boolean;
  isGuest?: boolean;
  isRegistered?: boolean;
  onRequireAccount?: () => void;
};

function GuestQrPlaceholder() {
  return (
    <View style={styles.guestQrPlaceholder}>
      <Ionicons name="qr-code-outline" size={88} color="rgba(0,0,0,0.12)" />
    </View>
  );
}

function LockedQrOverlay({
  onPress,
  iconColor,
}: {
  onPress: () => void;
  iconColor: string;
}) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.qrLockOverlay]}>
      <BlurView intensity={35} tint="light" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255, 255, 255, 0.45)' }]} />
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Unlock membership card">
        <Ionicons name="lock-closed" size={32} color={iconColor} />
      </Pressable>
    </View>
  );
}

export function QrPassCard({
  token,
  loading,
  checkedInToday,
  memberName,
  expiryDate,
  expiryLoading = false,
  isGuest = false,
  isRegistered = false,
  onRequireAccount,
}: Props) {
  const { colors, typography, inset, radii, radius, gap } = useTheme();
  const { isOnline, networkStatusKnown } = useNetworkStatus();
  const router = useRouter();

  const handleUnlockPress = () => {
    triggerLightImpact();
    if (onRequireAccount) {
      onRequireAccount();
      return;
    }
    if (isRegistered) {
      router.push('/activation-required');
      return;
    }
    if (useAuthStore.getState().role === 'guest') {
      useAuthStore.getState().logout();
    }
    router.push('/(auth)/register');
  };

  const showActivationLock = !isGuest && isRegistered && !loading && !token;
  const showOfflinePass =
    !isGuest && !loading && !token && !showActivationLock && networkStatusKnown && !isOnline;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Digital membership card for ${memberName}.${expiryDate ? ` ${expiryDate}.` : ''}`}
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
            {checkedInToday ? 'CHECKED IN TODAY' : isGuest ? 'PREVIEW CARD' : 'MEMBER CARD'}
          </Text>
        </View>

        <View
          style={[
            styles.identityPill,
            { borderRadius: radius.pill, backgroundColor: colors.brand.red + '22' },
          ]}
        >
          <Text style={[styles.pillLabel, { color: colors.brand.red }]}>
            971 MMA
          </Text>
        </View>
      </View>

      <View style={styles.qrWrap}>
        {isGuest ? (
          <View style={[styles.qrFrame, { borderRadius: radii.lg, overflow: 'hidden', position: 'relative' }]}>
            <GuestQrPlaceholder />
            <LockedQrOverlay onPress={handleUnlockPress} iconColor={colors.accent.default} />
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
        ) : showOfflinePass ? (
          <View style={[styles.qrPlaceholder, { borderRadius: radii.lg }]}>
            <Ionicons name="cloud-offline-outline" size={48} color="rgba(255,255,255,0.35)" />
            <Text style={styles.errorLabel}>Connect to refresh your pass</Text>
            <Text style={styles.offlineHint}>Your membership card needs internet to load a secure QR code.</Text>
          </View>
        ) : showActivationLock ? (
          <View style={[styles.qrFrame, { borderRadius: radii.lg, overflow: 'hidden', position: 'relative' }]}>
            <GuestQrPlaceholder />
            <LockedQrOverlay onPress={handleUnlockPress} iconColor={colors.accent.default} />
          </View>
        ) : (
          <View style={[styles.qrPlaceholder, { borderRadius: radii.lg }]}>
            <Ionicons name="qr-code-outline" size={48} color="rgba(255,255,255,0.35)" />
            <Text style={styles.errorLabel}>Unable to load card</Text>
          </View>
        )}
      </View>

      <View style={[styles.memberBlock, { gap: gap.xs }]}>
        <Text style={[styles.memberName, { color: ON_INVERSE.text }]} numberOfLines={1}>
          {memberName}
        </Text>
        {expiryDate ? (
          <Text style={[styles.expiryLine, { color: ON_INVERSE.muted }]} numberOfLines={1}>
            {expiryDate}
          </Text>
        ) : expiryLoading ? (
          <Text style={[styles.expiryLine, { color: ON_INVERSE.subtle }]} numberOfLines={1}>
            Syncing end date from Mindbody…
          </Text>
        ) : null}
      </View>

      {isGuest && !isRegistered ? (
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
            Join the Academy
          </Text>
        </Pressable>
      ) : null}
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
  guestQrPlaceholder: {
    alignItems: 'center',
    height: 208,
    justifyContent: 'center',
    width: 208,
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
  offlineHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
    paddingHorizontal: 16,
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
  expiryLine: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    fontWeight: '600',
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
