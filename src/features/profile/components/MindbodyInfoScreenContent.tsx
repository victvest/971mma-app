import React, { memo, useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Barcode from 'react-native-barcode-svg';
import { useFocusEffect } from 'expo-router';

import { AcademyEyebrow } from '@/shared/components/brand';
import { RevealOnMount } from '@/shared/animations';
import { AppScrollView } from '@/shared/components/ui';
import { Card } from '@/shared/components/ui/Card';
import { StateBlock } from '@/shared/components/StateBlock';
import { triggerLightImpact } from '@/shared/haptics';
import { useActiveProfileLabel, useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { useMindbodyClientInfo } from '@/features/profile/hooks/useMindbodyClientInfo';
import { useTheme } from '@/shared/theme';

type InfoFieldProps = {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  delay: number;
  replayKey: number;
};

const InfoField = memo(function InfoField({ label, value, icon, delay, replayKey }: InfoFieldProps) {
  const { colors, typography, radius, gap } = useTheme();

  return (
    <RevealOnMount replayKey={replayKey} delay={delay}>
      <Card variant="elevated" style={{ gap: gap.md }}>
        <View style={[styles.fieldHeader, { gap: gap.sm }]}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: colors.accent.subtle,
                borderRadius: radius.pill,
              },
            ]}
          >
            <Ionicons name={icon} size={18} color={colors.accent.default} />
          </View>
          <Text style={[typography.textPresets.label, { color: colors.text.secondary }]}>{label}</Text>
        </View>
        <Text
          selectable
          style={[typography.textPresets.title, styles.value, { color: colors.text.primary }]}
        >
          {value}
        </Text>
        <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
          Long-press to copy
        </Text>
      </Card>
    </RevealOnMount>
  );
});

type MemberBarcodeCardProps = {
  value: string;
  delay: number;
  replayKey: number;
};

const MemberBarcodeCard = memo(function MemberBarcodeCard({
  value,
  delay,
  replayKey,
}: MemberBarcodeCardProps) {
  const { colors, typography, radius, inset, gap } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const barcodeMaxWidth = Math.min(screenWidth - inset.lg * 2 - inset.md * 2, 320);

  return (
    <RevealOnMount replayKey={replayKey} delay={delay}>
      <Card variant="elevated" style={{ gap: gap.md, alignItems: 'center' }}>
        <View style={[styles.fieldHeader, styles.barcodeHeader, { gap: gap.sm }]}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: colors.accent.subtle,
                borderRadius: radius.pill,
              },
            ]}
          >
            <Ionicons name="barcode-outline" size={18} color={colors.accent.default} />
          </View>
          <Text style={[typography.textPresets.label, { color: colors.text.secondary }]}>
            Member barcode
          </Text>
        </View>

        <View
          style={[
            styles.barcodeFrame,
            {
              backgroundColor: colors.background.primary,
              borderColor: colors.border.subtle,
              borderRadius: radius.card,
              paddingHorizontal: inset.md,
              paddingVertical: inset.md,
            },
          ]}
        >
          <Barcode
            value={value}
            format="CODE128"
            maxWidth={barcodeMaxWidth}
            height={88}
            singleBarWidth={2}
            lineColor={colors.text.primary}
            backgroundColor={colors.background.primary}
          />
        </View>

        <Text
          selectable
          style={[typography.textPresets.title, styles.value, { color: colors.text.primary }]}
        >
          {value}
        </Text>
        <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
          Show this at the front desk scanner
        </Text>
      </Card>
    </RevealOnMount>
  );
});

export function MindbodyInfoScreenContent() {
  const { colors, typography, inset, gap } = useTheme();
  const profileLabel = useActiveProfileLabel();
  const viewingChild = useIsViewingChildProfile();
  const { data, error, isLoading, isError, refetch } = useMindbodyClientInfo();
  const [replayKey, setReplayKey] = React.useState(0);

  useFocusEffect(
    useCallback(() => {
      setReplayKey((current) => current + 1);
      void refetch();
    }, [refetch]),
  );

  const contentPadding = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: 8,
      paddingBottom: inset.xl,
      gap: gap.xl,
    }),
    [gap.xl, inset.lg, inset.xl],
  );

  const errorMessage =
    error instanceof Error ? error.message : 'Please check your connection and try again.';

  const isNotLinked =
    error &&
    typeof error === 'object' &&
    'rawCode' in error &&
    (error as { rawCode?: string }).rawCode === 'NOT_LINKED';

  return (
    <AppScrollView contentContainerStyle={contentPadding} showsVerticalScrollIndicator={false}>
      <RevealOnMount replayKey={replayKey} delay={0}>
        <View style={{ gap: gap.sm }}>
          <AcademyEyebrow label="Mindbody" />
          <Text style={[typography.textPresets.hero, { color: colors.text.primary }]}>
            {viewingChild ? `${profileLabel}'s credentials` : 'Your Mindbody credentials'}
          </Text>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            Your scannable gym barcode and Mindbody client ID, pulled live for the active profile.
          </Text>
        </View>
      </RevealOnMount>

      {isLoading ? (
        <RevealOnMount replayKey={replayKey} delay={80}>
          <StateBlock kind="loading" title="Fetching from Mindbody" />
        </RevealOnMount>
      ) : isError ? (
        <RevealOnMount replayKey={replayKey} delay={80}>
          <StateBlock
            kind="error"
            title={isNotLinked ? 'Mindbody not linked' : 'Could not load credentials'}
            message={
              isNotLinked
                ? 'This profile is not linked to a Mindbody account yet. Contact the front desk if you need help.'
                : errorMessage
            }
            actionLabel="Retry"
            onAction={() => {
              triggerLightImpact();
              void refetch();
            }}
          />
        </RevealOnMount>
      ) : data ? (
        <>
          {data.barcode ? (
            <MemberBarcodeCard value={data.barcode} delay={80} replayKey={replayKey} />
          ) : (
            <RevealOnMount replayKey={replayKey} delay={80}>
              <StateBlock kind="empty" title="No barcode assigned" message="Ask the front desk to set up your member barcode in Mindbody." />
            </RevealOnMount>
          )}
          <InfoField
            label="Client ID"
            value={data.clientId ?? 'Not available'}
            icon="finger-print-outline"
            delay={140}
            replayKey={replayKey}
          />
          <RevealOnMount replayKey={replayKey} delay={200}>
            <Pressable
              onPress={() => {
                triggerLightImpact();
                void refetch();
              }}
              accessibilityRole="button"
              accessibilityLabel="Refresh Mindbody credentials"
              style={({ pressed }) => [
                styles.refreshRow,
                {
                  borderColor: colors.border.subtle,
                  borderRadius: 12,
                  opacity: pressed ? 0.7 : 1,
                  paddingVertical: inset.sm,
                },
              ]}
            >
              <Ionicons name="refresh-outline" size={18} color={colors.accent.default} />
              <Text style={[typography.textPresets.bodyStrong, { color: colors.accent.default }]}>
                Refresh from Mindbody
              </Text>
            </Pressable>
          </RevealOnMount>
        </>
      ) : null}
    </AppScrollView>
  );
}

const styles = StyleSheet.create({
  barcodeFrame: {
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    width: '100%',
  },
  barcodeHeader: {
    alignSelf: 'flex-start',
  },
  fieldHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  iconWrap: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  refreshRow: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  value: {
    letterSpacing: 0.4,
    textAlign: 'center',
  },
});
