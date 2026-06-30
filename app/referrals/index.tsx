import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassNavChrome } from '@/features/home/components/navigation/GlassNavChrome';
import { NAV_CHROME, UAE } from '@/features/home/components/navigation/uaeChrome';
import { ReferralProgramCard } from '@/features/rewards/components/ReferralProgramCard';
import { useReferralCode } from '@/features/rewards/hooks/useReferrals';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { triggerLightImpact } from '@/shared/haptics';
import { useAppTopInset } from '@/shared/hooks/useAppTopInset';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { StateBlock } from '@/shared/components/StateBlock';
import { AcademyEyebrow, TabHeroTitle } from '@/shared/components/brand';
import { AppScrollView } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';

export default function ReferralsScreen() {
  const router = useRouter();
  const { colors, typography, inset, gap } = useTheme();
  const { contentBottomInset } = useResponsiveLayout();
  const topInset = useAppTopInset();
  const floatingNavTop = topInset + inset.xs;
  const floatingNavHeight = NAV_CHROME.clusterHeight;
  const scrollTopInset = floatingNavTop + floatingNavHeight + inset.sm;

  const accountStatus = useAuthStore((s) => s.user?.accountStatus ?? 'registered');
  const viewingChild = useIsViewingChildProfile();
  const canRefer = accountStatus === 'active' && !viewingChild;

  const referralCodeQuery = useReferralCode();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    triggerLightImpact();
    setRefreshing(true);
    try {
      await referralCodeQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [referralCodeQuery]);

  const scrollPadding = {
    paddingHorizontal: inset.lg,
    paddingTop: scrollTopInset,
    paddingBottom: contentBottomInset,
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background.primary }]} edges={['left', 'right']}>
      <View
        pointerEvents="box-none"
        style={[styles.floatingNav, { paddingTop: floatingNavTop, paddingHorizontal: inset.lg }]}
      >
        <View style={styles.floatingNavRow}>
          <GlassNavChrome
            onPress={() => {
              triggerLightImpact();
              router.back();
            }}
            accessibilityLabel="Go back"
            style={styles.floatingNavButton}
            contentStyle={styles.floatingNavButtonInner}
          >
            <Ionicons name="chevron-back" size={NAV_CHROME.iconSize} color={UAE.ink} />
          </GlassNavChrome>

          <View style={styles.floatingNavTitleWrap}>
            <Text
              numberOfLines={1}
              style={[typography.textPresets.bodyStrong, { color: colors.text.primary, textAlign: 'center' }]}
            >
              Refer and earn
            </Text>
          </View>

          <View style={styles.floatingNavSide} />
        </View>
      </View>

      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, scrollPadding]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            progressViewOffset={scrollTopInset}
            tintColor={colors.accent.default}
          />
        }
      >
        <View style={[styles.hero, { gap: gap.sm, marginBottom: gap.lg }]}>
          <AcademyEyebrow label="Referrals" accent showFlag={false} />
          <TabHeroTitle
            collapseOnWide
            lines={[
              [{ text: 'Refer and ' }],
              [{ text: 'earn.', accent: true }],
            ]}
          />
        </View>

        {!canRefer ? (
          <StateBlock
            kind="empty"
            title="Referrals unavailable"
            message={
              viewingChild
                ? 'Switch to your account to share your referral code.'
                : 'Activate your membership to get your referral code and start earning.'
            }
          />
        ) : referralCodeQuery.isError ? (
          <StateBlock
            kind="error"
            title="Could not load referral code"
            message="Pull to refresh or try again in a moment."
            actionLabel="Retry"
            onAction={handleRefresh}
          />
        ) : (
          <ReferralProgramCard
            referralCode={referralCodeQuery.data ?? null}
            isLoadingCode={referralCodeQuery.isLoading}
            compact
          />
        )}
      </AppScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  floatingNav: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
  floatingNavRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  floatingNavButton: {
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  floatingNavButtonInner: {
    flex: 1,
    height: NAV_CHROME.clusterHeight,
    width: NAV_CHROME.clusterHeight,
  },
  floatingNavTitleWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  floatingNavSide: {
    minWidth: NAV_CHROME.clusterHeight,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    marginTop: 4,
  },
});
