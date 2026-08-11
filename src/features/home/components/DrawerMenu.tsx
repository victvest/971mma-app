import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { AppScrollView } from '@/shared/components/ui';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IOSGlassSurface } from '@/shared/components/ui/IOSGlassSurface';
import { DrawerMenuHeader } from '@/shared/components/navigation/DrawerMenuHeader';
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTheme } from '@/shared/theme';
import { useIsGuest } from '@/shared/hooks/useIsGuest';
import type { AccountActionKey } from '@/shared/auth/accountActionCopy';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRankEligibility } from '@/features/auth/hooks/useMemberDisciplines';
import { triggerLightImpact } from '@/shared/haptics';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import { Image } from 'expo-image';
import drawerBrandMark from '../../../../assets/brand/logo-notext.png';
type NavItem = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  route: string;
};

type DrawerMenuProps = {
  visible: boolean;
  onClose: () => void;
  blurTargetRef?: React.RefObject<View | null>;
  onLockedRoute?: (actionKey: AccountActionKey) => void;
};

const LOCKED_ROUTE_ACTIONS: Record<string, AccountActionKey> = {
  '/family-trainees': 'family-profiles',
  '/(tabs)/belt-path': 'track-progress',
  '/(tabs)/rewards': 'earn-rewards',
};

const NAV_ITEMS: NavItem[] = [
  { icon: 'people-outline', label: 'Family profiles', route: '/family-trainees' },
  { icon: 'ribbon-outline', label: 'Belt path', route: '/(tabs)/belt-path' },
  { icon: 'gift-outline', label: 'Rewards', route: '/(tabs)/rewards' },
  { icon: 'information-circle-outline', label: 'About', route: '/about' },
  { icon: 'star-outline', label: 'Lineage', route: '/lineage' },
  { icon: 'help-buoy-outline', label: 'Help & support', route: '/help' },
  { icon: 'document-text-outline', label: 'Legal', route: '/legal' },
];

const CHILD_PROFILE_NAV_ITEMS: NavItem[] = [
  { icon: 'ribbon-outline', label: 'Belt path', route: '/(tabs)/belt-path' },
  { icon: 'gift-outline', label: 'Rewards', route: '/(tabs)/rewards' },
];

const CLOSE_TIMING = { duration: 190 } as const;
const OPEN_SPRING = {
  damping: 28,
  stiffness: 280,
  mass: 0.9,
} as const;

type DrawerNavItemProps = {
  item: NavItem;
  badgeCount?: number;
  onNavigate: (route: string) => void;
};

const DrawerNavItem = memo(function DrawerNavItem({
  item,
  badgeCount = 0,
  onNavigate,
}: DrawerNavItemProps) {
  const { colors, typography, inset, gap, animations } = useTheme();
  const handlePress = useCallback(() => onNavigate(item.route), [item.route, onNavigate]);
  const showBadge = badgeCount > 0;

  return (
    <Pressable
      onPressIn={triggerLightImpact}
      onPress={handlePress}
      accessibilityLabel={showBadge ? `${item.label}, ${badgeCount} unread` : item.label}
      style={({ pressed }) => [
        styles.navItem,
        {
          gap: gap.md,
          paddingHorizontal: inset['2xs'],
          paddingVertical: inset.sm,
          opacity: pressed ? animations.alpha.pressed : animations.alpha.visible,
        },
      ]}
    >
      <Ionicons name={item.icon} size={typography.fontSize.xl} color={colors.text.secondary} />
      <Text
        style={[typography.textPresets.bodyStrong, styles.navLabel, { color: colors.text.primary }]}
      >
        {item.label}
      </Text>
      {showBadge ? (
        <View style={[styles.badge, { backgroundColor: colors.status.error }]}>
          <Text
            style={[
              typography.textPresets.caption,
              styles.badgeText,
              { color: colors.text.inverse },
            ]}
          >
            {badgeCount > 99 ? '99+' : badgeCount}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

export function DrawerMenu({ visible, onClose, blurTargetRef, onLockedRoute }: DrawerMenuProps) {
  const { colors, typography, inset, gap, radius, layout, animations, surfaceShadow } = useTheme();
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();
  const { drawer } = useResponsiveLayout();
  const role = useAuthStore((s) => s.role);
  const rankEligibilityQuery = useRankEligibility();
  const { hasLimitedAccess, isAnonymousGuest, needsActivation } = useIsGuest();
  const viewingChild = useIsViewingChildProfile();
  const canCoach = !viewingChild && (role === 'coach' || role === 'admin');
  const navItems = useMemo(
    () => (viewingChild ? CHILD_PROFILE_NAV_ITEMS : NAV_ITEMS),
    [viewingChild],
  );
  const [mounted, setMounted] = useState(visible);
  const [activeView, setActiveView] = useState<'drawer' | 'disclaimer'>('drawer');
  const progress = useSharedValue(visible ? 1 : 0);
  const backdropProgress = useSharedValue(visible ? 1 : 0);
  const disclaimerProgress = useSharedValue(0);
  const contentTopPadding = Math.round(inset.lg * 0.8);
  const headerBottomSpacing = Math.round(gap.xl * 0.8);

  const finishClose = useCallback(() => {
    setMounted(false);
    onClose();
  }, [onClose]);

  const finishNavigate = useCallback(
    (route: string) => {
      setMounted(false);
      onClose();
      router.push(route as never);
    },
    [onClose, router],
  );

  useEffect(() => {
    cancelAnimation(progress);
    cancelAnimation(backdropProgress);
    cancelAnimation(disclaimerProgress);

    if (visible) {
      setMounted(true);
      setActiveView('drawer');
      disclaimerProgress.value = 0;
      progress.value = withSpring(1, OPEN_SPRING);
      backdropProgress.value = withTiming(1, { duration: 250 });
      return;
    }

    if (mounted) {
      progress.value = withTiming(0, CLOSE_TIMING);
      disclaimerProgress.value = withTiming(0, CLOSE_TIMING);
      backdropProgress.value = withTiming(0, CLOSE_TIMING, (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        }
      });
    }
  }, [mounted, progress, backdropProgress, disclaimerProgress, visible, finishClose]);

  const finishLockedAction = useCallback(
    (actionKey: AccountActionKey) => {
      setMounted(false);
      onClose();
      onLockedRoute?.(actionKey);
    },
    [onClose, onLockedRoute],
  );

  const requestClose = useCallback(() => {
    cancelAnimation(progress);
    cancelAnimation(backdropProgress);
    cancelAnimation(disclaimerProgress);

    progress.value = withTiming(0, CLOSE_TIMING);
    disclaimerProgress.value = withTiming(0, CLOSE_TIMING);
    backdropProgress.value = withTiming(0, CLOSE_TIMING, (finished) => {
      if (finished) {
        runOnJS(finishClose)();
      }
    });
  }, [finishClose, progress, backdropProgress, disclaimerProgress]);

  const navigate = useCallback(
    (route: string) => {
      cancelAnimation(progress);
      cancelAnimation(backdropProgress);
      cancelAnimation(disclaimerProgress);

      progress.value = withTiming(0, CLOSE_TIMING);
      disclaimerProgress.value = withTiming(0, CLOSE_TIMING);
      backdropProgress.value = withTiming(0, CLOSE_TIMING, (finished) => {
        if (finished) {
          runOnJS(finishNavigate)(route);
        }
      });
    },
    [finishNavigate, progress, backdropProgress, disclaimerProgress],
  );

  const getLockedAction = useCallback(
    (route: string): AccountActionKey | undefined => {
      const action = LOCKED_ROUTE_ACTIONS[route];
      if (!action) return undefined;
      if (needsActivation) return action;
      if (isAnonymousGuest && route === '/(tabs)/belt-path') return action;
      if (hasLimitedAccess) return action;
      return undefined;
    },
    [hasLimitedAccess, isAnonymousGuest, needsActivation],
  );

  const handleNavPress = useCallback(
    (route: string) => {
      const lockedAction = getLockedAction(route);
      if (lockedAction) {
        cancelAnimation(progress);
        cancelAnimation(backdropProgress);
        cancelAnimation(disclaimerProgress);

        progress.value = withTiming(0, CLOSE_TIMING);
        disclaimerProgress.value = withTiming(0, CLOSE_TIMING);
        backdropProgress.value = withTiming(0, CLOSE_TIMING, (finished) => {
          if (finished) {
            runOnJS(finishLockedAction)(lockedAction);
          }
        });
        return;
      }

      if (route === '/(tabs)/belt-path' && rankEligibilityQuery.data?.eligible === false) {
        cancelAnimation(progress);
        cancelAnimation(disclaimerProgress);
        setActiveView('disclaimer');
        progress.value = withTiming(0, CLOSE_TIMING);
        disclaimerProgress.value = withSpring(1, OPEN_SPRING);
        return;
      }

      navigate(route);
    },
    [
      finishLockedAction,
      getLockedAction,
      navigate,
      progress,
      disclaimerProgress,
      backdropProgress,
      rankEligibilityQuery.data?.eligible,
    ],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(backdropProgress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const drawerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [-(drawer.width + drawer.left + inset.lg), 0],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(progress.value, [0, 1], [0.985, 1], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 0.35, 1], [0, 1, 1], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ translateX }, { scale }],
    };
  });

  const disclaimerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(disclaimerProgress.value, [0, 1], [600, 0], Extrapolation.CLAMP);
    const opacity = interpolate(
      disclaimerProgress.value,
      [0, 0.5, 1],
      [0, 1, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  if (!mounted) return null;

  const logoSize = 36;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <BlurView
            intensity={100}
            tint="dark"
            blurMethod="dimezisBlurView"
            blurReductionFactor={1}
            blurTarget={blurTargetRef}
            style={StyleSheet.absoluteFill}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.backdrop,
              { backgroundColor: colors.background.overlay },
            ]}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPressIn={triggerLightImpact}
            onPress={requestClose}
            accessibilityLabel="Close menu"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.floatingShell,
            surfaceShadow('card'),
            {
              borderColor: colors.border.subtle,
              borderWidth: layout.borderWidth,
              borderRadius: drawer.radius,
              height: drawer.height,
              left: drawer.left,
              top: drawer.top,
              width: drawer.width,
            },
            drawerStyle,
          ]}
        >
          <IOSGlassSurface
            borderRadius={drawer.radius}
            style={styles.glassShell}
            contentStyle={[
              styles.panelContent,
              {
                paddingHorizontal: drawer.paddingH,
                paddingTop: contentTopPadding,
                paddingBottom: safeInsets.bottom + inset.lg,
              },
            ]}
          >
            <View style={{ marginBottom: headerBottomSpacing }}>
              <DrawerMenuHeader onClose={requestClose} />
            </View>

            <View style={[styles.taglineBlock, { gap: gap.md, marginBottom: gap.lg }]}>
              <Text
                style={[
                  typography.textPresets.coachDisplayCompact,
                  {
                    color: colors.text.primary,
                    fontSize: drawer.titleSize,
                    lineHeight: Math.round(drawer.titleSize * 1.1),
                  },
                ]}
              >
                Earn Your{'\n'}
                <Text style={{ color: colors.accent.default }}>Level.</Text>
              </Text>
              <Text style={[typography.textPresets.footnote, { color: colors.text.secondary }]}>
                Your training progress, ranks, and rewards in one place.
              </Text>
            </View>

            <AppScrollView
              style={styles.navScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.navContent,
                { gap: inset['2xs'], paddingBottom: inset.md },
              ]}
            >
              {navItems.map((item) => (
                <DrawerNavItem key={item.label} item={item} onNavigate={handleNavPress} />
              ))}
            </AppScrollView>

            {canCoach ? (
              <View style={[styles.footer, { gap: gap.sm, paddingTop: inset.xs }]}>
                <Pressable
                  onPressIn={triggerLightImpact}
                  onPress={() => navigate('/(coach)/(main)')}
                  style={({ pressed }) => [
                    styles.footerBtn,
                    {
                      borderRadius: radius.button,
                      backgroundColor: colors.accent.subtle,
                      minHeight: layout.authButtonHeight,
                      paddingHorizontal: inset.md,
                      gap: gap.sm,
                      opacity: pressed ? animations.alpha.pressed : animations.alpha.visible,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={typography.fontSize.lg}
                    color={colors.accent.default}
                  />
                  <Text style={[typography.textPresets.button, { color: colors.accent.default }]}>
                    Switch to coach mode
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View style={{ alignItems: 'center', paddingTop: inset.sm }}>
              <Text style={[typography.textPresets.caption, { color: colors.text.tertiary }]}>
                Developed by VictVest
              </Text>
            </View>
          </IOSGlassSurface>
        </Animated.View>

        <Animated.View style={[styles.disclaimerSheetContainer, disclaimerStyle]}>
          <View
            style={[
              styles.disclaimerSheet,
              {
                backgroundColor: colors.surface.primary,
                borderTopLeftRadius: radius.modal,
                borderTopRightRadius: radius.modal,
                paddingHorizontal: inset.lg,
                paddingTop: inset.md,
                paddingBottom: safeInsets.bottom + inset.lg,
                gap: gap.lg,
              },
            ]}
          >
            <View style={styles.disclaimerHeader}>
              <Image
                source={drawerBrandMark}
                contentFit="contain"
                cachePolicy="memory-disk"
                accessibilityLabel="971 MMA"
                style={{
                  width: logoSize,
                  height: logoSize,
                  tintColor: colors.text.primary,
                }}
              />

              <Pressable
                onPressIn={triggerLightImpact}
                onPress={requestClose}
                accessibilityLabel="Close disclaimer"
                style={[
                  styles.disclaimerCloseBtn,
                  {
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    backgroundColor: colors.fill.secondary,
                  },
                ]}
              >
                <Ionicons name="close" size={20} color={colors.text.primary} />
              </Pressable>
            </View>

            <View style={[styles.disclaimerBody, { gap: gap.md, paddingVertical: 12 }]}>
              <Text
                style={[
                  typography.textPresets.coachDisplayCompact,
                  {
                    color: colors.text.primary,
                    fontSize: 36,
                    lineHeight: 40,
                    fontWeight: '800',
                  },
                ]}
              >
                Earn Your{'\n'}
                <Text style={{ color: colors.accent.default }}>Level.</Text>
              </Text>
              <Text
                style={[
                  typography.textPresets.body,
                  { color: colors.text.secondary, fontSize: 16 },
                ]}
              >
                Your training progress, ranks, and rewards in one place.
              </Text>
            </View>

            <View
              style={[
                styles.infoCallout,
                {
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.border.subtle,
                  borderRadius: radius.card,
                  padding: inset.md,
                  gap: gap.xs,
                },
              ]}
            >
              <View style={styles.infoCalloutHeader}>
                <Ionicons name="information-circle" size={20} color={colors.accent.default} />
                <Text
                  style={[
                    typography.textPresets.bodyStrong,
                    { color: colors.text.primary, fontSize: 14 },
                  ]}
                >
                  Progression Path Inactive
                </Text>
              </View>
              <Text
                style={[
                  typography.textPresets.footnote,
                  { color: colors.text.secondary, lineHeight: 18 },
                ]}
              >
                This section is only accessible to trainees currently enrolled in a ranking program
                (such as Jiu-Jitsu). Please contact the front desk or support if you need to
                activate progression tracking for this profile.
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    opacity: 0.5,
  },
  floatingShell: {
    position: 'absolute',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
    }),
  },
  glassShell: {
    flex: 1,
  },
  panelContent: {
    flex: 1,
  },
  taglineBlock: {},
  navScroll: {
    flex: 1,
  },
  navContent: {},
  navItem: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  navLabel: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 999,
    justifyContent: 'center',
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontWeight: '700',
  },
  footer: {},
  footerBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disclaimerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  disclaimerSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 900,
  },
  disclaimerSheet: {
    borderWidth: 0,
    minHeight: 380,
  },
  disclaimerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  disclaimerCloseBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerBody: {
    justifyContent: 'center',
  },
  infoCallout: {
    borderWidth: 1,
    width: '100%',
  },
  infoCalloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
});
