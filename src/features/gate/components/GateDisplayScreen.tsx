import React, { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  GATE_EXIT_LONG_PRESS_MS,
  GateExitGuard,
  useGateExit,
} from '@/features/gate/components/GateExitGuard';
import { GateQrFrame } from '@/features/gate/components/GateQrFrame';
import { GateRefreshCountdown } from '@/features/gate/components/GateRefreshCountdown';
import { useGateQr } from '@/features/gate/hooks/useGateQr';
import { TabHeroTitle, UaeAccentBar } from '@/shared/components/brand';
import { StateBlock } from '@/shared/components/StateBlock';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { useTheme } from '@/shared/theme';
import { PerfMark, usePerfOnceReady, usePerfRouteMount } from '@/shared/performance';

import gateLogo from '../../../../assets/brand/971-logo-black.png';

const KEEP_AWAKE_TAG = '971-gate-display';
const LOGO_WIDTH_RATIO = 0.68;
const LOGO_MAX_WIDTH = 380;

function GateDisplayContent() {
  const { colors, typography, inset, radius, gap } = useTheme();
  usePerfRouteMount(PerfMark.routeGateMount);
  const { width: screenWidth } = useWindowDimensions();
  const { isOnline } = useNetworkStatus();
  const { requestExit } = useGateExit();
  const [focused, setFocused] = useState(true);
  const gateQrQuery = useGateQr(focused);

  const logoSize = useMemo(() => {
    const width = Math.min(LOGO_MAX_WIDTH, Math.round(screenWidth * LOGO_WIDTH_RATIO));
    return { width, height: Math.round(width * 0.42) };
  }, [screenWidth]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      return () => {
        setFocused(false);
        void deactivateKeepAwake(KEEP_AWAKE_TAG);
      };
    }, []),
  );

  const token = gateQrQuery.data?.token;
  const loading = !token && (gateQrQuery.isLoading || gateQrQuery.isFetching);

  usePerfOnceReady(PerfMark.gateQrVisible, Boolean(token));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background.primary }]}>
      <StatusBar style="dark" />

      {!isOnline ? (
        <View
          style={[
            styles.offlineBanner,
            {
              backgroundColor: colors.status.error,
              paddingVertical: inset.sm,
              paddingHorizontal: inset.lg,
            },
          ]}
        >
          <Text style={[typography.textPresets.label, { color: colors.text.inverse }]}>
            Offline — QR may be stale
          </Text>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="971 MMA"
        accessibilityHint="Staff: hold for three seconds to exit gate mode"
        delayLongPress={GATE_EXIT_LONG_PRESS_MS}
        onLongPress={requestExit}
        style={[styles.logoWrap, { paddingTop: inset.xs, paddingHorizontal: inset.lg }]}
      >
        <Image
          source={gateLogo}
          style={logoSize}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
        />
      </Pressable>

      <View
        style={[
          styles.main,
          {
            paddingHorizontal: inset.lg,
            paddingBottom: inset.xl,
            gap: gap.lg,
          },
        ]}
      >
        <View style={[styles.titleWrap, { gap: gap.sm }]}>
          <TabHeroTitle
            lines={[[{ text: 'Scan to ', accent: false }, { text: 'check in', accent: true }]]}
          />
        </View>

        {gateQrQuery.isError && !token ? (
          <StateBlock
            kind="error"
            title="Display unavailable"
            message="Unable to load the entrance QR. Check the connection and try again."
            actionLabel="Retry"
            onAction={() => void gateQrQuery.refetch()}
          />
        ) : (
          <View
            accessibilityRole="summary"
            accessibilityLabel="Entrance check-in display. QR code refreshes every 20 seconds."
            style={[
              styles.displayCard,
              {
                backgroundColor: colors.background.inverse,
                borderRadius: radius.cardLarge,
                borderColor: colors.border.onPromo,
                padding: inset.lg,
                gap: gap.lg,
              },
            ]}
          >
            <View style={styles.accentWrap}>
              <UaeAccentBar height={3} />
            </View>

            <View style={styles.liveRow}>
              <View
                style={[
                  styles.livePill,
                  {
                    borderRadius: radius.pill,
                    backgroundColor: colors.accent.default + '22',
                  },
                ]}
              >
                <View style={[styles.liveDot, { backgroundColor: colors.accent.default }]} />
                <Text style={[typography.textPresets.label, { color: colors.accent.default }]}>
                  LIVE
                </Text>
              </View>
            </View>

            <GateQrFrame token={token} loading={loading} />
            <GateRefreshCountdown />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

export function GateDisplayScreen() {
  return (
    <GateExitGuard>
      <GateDisplayContent />
    </GateExitGuard>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  offlineBanner: {
    alignItems: 'center',
  },
  logoWrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  main: {
    flex: 1,
    justifyContent: 'center',
  },
  titleWrap: {
    alignItems: 'center',
  },
  displayCard: {
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  accentWrap: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  liveRow: {
    alignItems: 'center',
  },
  livePill: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
});
