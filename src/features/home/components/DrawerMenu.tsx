import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import { useResponsiveLayout } from '@/shared/layout/useResponsiveLayout';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRankEligibility } from '@/features/auth/hooks/useMemberDisciplines';
import { triggerLightImpact } from '@/shared/haptics';
type NavItem = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  route: string;
};

type DrawerMenuProps = {
  visible: boolean;
  onClose: () => void;
  blurTargetRef?: React.RefObject<View | null>;
};

const NAV_ITEMS: NavItem[] = [
  { icon: 'people-outline', label: 'Family trainees', route: '/family-trainees' },
  { icon: 'ribbon-outline', label: 'Belt path', route: '/(tabs)/belt-path' },
  { icon: 'gift-outline', label: 'Rewards', route: '/(tabs)/rewards' },
  { icon: 'information-circle-outline', label: 'About', route: '/about' },
  { icon: 'star-outline', label: 'Lineage', route: '/lineage' },
  { icon: 'help-buoy-outline', label: 'Help & support', route: '/help' },
  { icon: 'shield-checkmark-outline', label: 'Privacy policy', route: '/privacy' },
  { icon: 'document-text-outline', label: 'Terms & conditions', route: '/terms' },
];

const CLOSE_TIMING = { duration: 190 } as const;
const OPEN_SPRING = {
  damping: 28,
  stiffness: 280,
  mass: 0.9,
} as const;

type DrawerNavItemProps = {
  item: NavItem;
  onNavigate: (route: string) => void;
};

const DrawerNavItem = memo(function DrawerNavItem({ item, onNavigate }: DrawerNavItemProps) {
  const { colors, typography, inset, gap, animations } = useTheme();
  const handlePress = useCallback(() => onNavigate(item.route), [item.route, onNavigate]);

  return (
    <Pressable
      onPressIn={triggerLightImpact}
      onPress={handlePress}
      accessibilityLabel={item.label}
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
      <Text style={[typography.textPresets.bodyStrong, styles.navLabel, { color: colors.text.primary }]}>
        {item.label}
      </Text>
    </Pressable>
  );
});

export function DrawerMenu({ visible, onClose, blurTargetRef }: DrawerMenuProps) {
  const { colors, typography, inset, gap, radius, layout, animations } = useTheme();
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();
  const { drawer } = useResponsiveLayout();
  const role = useAuthStore((s) => s.role);
  const rankEligibilityQuery = useRankEligibility();
  const canCoach = role === 'coach' || role === 'admin';
  const navItems = useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) => item.route !== '/(tabs)/belt-path' || rankEligibilityQuery.data?.eligible === true,
      ),
    [rankEligibilityQuery.data?.eligible],
  );
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);
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

    if (visible) {
      setMounted(true);
      progress.value = withSpring(1, OPEN_SPRING);
      return;
    }

    if (mounted) {
      progress.value = withTiming(0, CLOSE_TIMING, (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }
  }, [mounted, progress, visible]);

  const requestClose = useCallback(() => {
    cancelAnimation(progress);
    progress.value = withTiming(0, CLOSE_TIMING, (finished) => {
      if (finished) {
        runOnJS(finishClose)();
      }
    });
  }, [finishClose, progress]);

  const navigate = useCallback(
    (route: string) => {
      cancelAnimation(progress);
      progress.value = withTiming(0, CLOSE_TIMING, (finished) => {
        if (finished) {
          runOnJS(finishNavigate)(route);
        }
      });
    },
    [finishNavigate, progress],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
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

  if (!mounted) return null;

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
            {
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
            <View style={[styles.drawerHeader, { marginBottom: headerBottomSpacing }]}>
              <Pressable
                onPressIn={triggerLightImpact}
                onPress={requestClose}
                accessibilityLabel="Close navigation menu"
                style={({ pressed }) => [
                  styles.closeBtn,
                  {
                    width: layout.appHeaderIconTouch,
                    height: layout.appHeaderIconTouch,
                    borderRadius: radius.pill,
                    backgroundColor: colors.surface.primary,
                    opacity: pressed ? animations.alpha.pressed : animations.alpha.visible,
                  },
                ]}
              >
                <Ionicons name="close" size={typography.fontSize.lg} color={colors.text.primary} />
              </Pressable>
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
                Discipline made tactile. Owned by the academy.
              </Text>
            </View>

            <AppScrollView
              style={styles.navScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.navContent, { gap: inset['2xs'], paddingBottom: inset.md }]}
            >
              {navItems.map((item) => (
                <DrawerNavItem key={item.label} item={item} onNavigate={navigate} />
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
                  <Ionicons name="person-outline" size={typography.fontSize.lg} color={colors.accent.default} />
                  <Text style={[typography.textPresets.button, { color: colors.accent.default }]}>
                    Switch to coach mode
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </IOSGlassSurface>
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  glassShell: {
    flex: 1,
  },
  panelContent: {
    flex: 1,
  },
  drawerHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
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
  footer: {},
  footerBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
