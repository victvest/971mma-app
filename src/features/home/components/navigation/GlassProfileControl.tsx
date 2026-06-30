import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ChevronsUpDown } from 'lucide-react-native';
import { useActiveProfileOptions } from '@/features/guardian/hooks/useGuardian';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { useActiveProfileStore } from '@/stores/useActiveProfileStore';
import { triggerLightImpact } from '@/shared/haptics';
import { animations } from '@/shared/theme/animations';
import { NAV_CHROME, UAE } from './uaeChrome';

type Props = {
  label: string;
  avatarUrl?: string | null;
  onOpenProfile: () => void;
};

const SWIPE_THRESHOLD = 28;
const AVATAR = NAV_CHROME.avatarSize;

function normalizeAvatarUrl(url?: string | null): string | null {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}

function resolveSwitchDirection(prevIndex: number, nextIndex: number, total: number): 1 | -1 {
  if (prevIndex === total - 1 && nextIndex === 0) return 1;
  if (prevIndex === 0 && nextIndex === total - 1) return -1;
  return nextIndex > prevIndex ? 1 : -1;
}

export function GlassProfileControl({ label, avatarUrl, onOpenProfile }: Props) {
  const activeMemberId = useActiveMemberId();
  const setActiveUserId = useActiveProfileStore((s) => s.setActiveUserId);
  const { options, hasChildren } = useActiveProfileOptions();
  const resolvedAvatarUrl = normalizeAvatarUrl(avatarUrl);

  const currentIndex = Math.max(
    0,
    options.findIndex((option) => option.userId === activeMemberId),
  );
  const canSwitchProfiles = hasChildren && options.length > 1;

  const avatarOffsetY = useSharedValue(0);
  const hintScale = useSharedValue(1);
  const hintRotate = useSharedValue(0);
  const prevIndexRef = useRef(currentIndex);
  const didMountRef = useRef(false);

  const playSwitchAnimation = useCallback(
    (direction: 1 | -1) => {
      triggerLightImpact();
      avatarOffsetY.value = withSequence(
        withTiming(direction * -6, { duration: 110, easing: animations.easingCurves.snappy }),
        withSpring(0, animations.spring.snappy),
      );
      hintScale.value = withSequence(
        withTiming(1.18, { duration: 90, easing: animations.easingCurves.snappy }),
        withSpring(1, animations.spring.bouncy),
      );
      hintRotate.value = withSequence(
        withTiming(direction * 14, { duration: 120, easing: animations.easingCurves.snappy }),
        withSpring(0, animations.spring.gentle),
      );
    },
    [avatarOffsetY, hintRotate, hintScale],
  );

  useEffect(() => {
    if (!canSwitchProfiles) return;

    if (!didMountRef.current) {
      didMountRef.current = true;
      prevIndexRef.current = currentIndex;
      return;
    }

    const prevIndex = prevIndexRef.current;
    if (prevIndex === currentIndex) return;

    playSwitchAnimation(resolveSwitchDirection(prevIndex, currentIndex, options.length));
    prevIndexRef.current = currentIndex;
  }, [canSwitchProfiles, currentIndex, options.length, playSwitchAnimation]);

  const cycleProfile = useCallback(
    (direction: 1 | -1) => {
      if (!canSwitchProfiles) return;
      const nextIndex = (currentIndex + direction + options.length) % options.length;
      const nextOption = options[nextIndex];
      if (!nextOption) return;
      setActiveUserId(nextOption.isSelf ? null : nextOption.userId);
    },
    [canSwitchProfiles, currentIndex, options, setActiveUserId],
  );

  const handleSwipeEnd = useCallback(
    (translationY: number) => {
      if (Math.abs(translationY) < SWIPE_THRESHOLD) return;
      cycleProfile(translationY < 0 ? 1 : -1);
    },
    [cycleProfile],
  );

  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: avatarOffsetY.value }],
  }));

  const hintAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: hintScale.value }, { rotate: `${hintRotate.value}deg` }],
  }));

  const avatarBody = (
    <View style={styles.avatarWrap}>
      <Animated.View style={[styles.avatarRing, avatarAnimatedStyle]}>
        <MemberAvatar
          name={label}
          avatarUrl={resolvedAvatarUrl}
          size={AVATAR}
          backgroundColor="transparent"
          textColor={UAE.green}
          initialsStyle={styles.initials}
        />
        {canSwitchProfiles ? (
          <View style={styles.switchRail} pointerEvents="none">
            <View style={[styles.switchTick, styles.switchTickDim]} />
            <View style={[styles.switchTick, styles.switchTickActive]} />
            <View style={[styles.switchTick, styles.switchTickDim]} />
          </View>
        ) : null}
      </Animated.View>

      {canSwitchProfiles ? (
        <Animated.View
          style={[styles.switchHint, hintAnimatedStyle]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <ChevronsUpDown size={10} color={UAE.white} strokeWidth={2.6} />
        </Animated.View>
      ) : null}
    </View>
  );

  if (!canSwitchProfiles) {
    return (
      <Pressable
        onPress={onOpenProfile}
        accessibilityLabel="Open profile"
        hitSlop={8}
        style={styles.hit}
      >
        {avatarBody}
      </Pressable>
    );
  }

  const pan = Gesture.Pan()
    .activeOffsetY([-14, 14])
    .failOffsetX([-18, 18])
    .onEnd((event) => {
      runOnJS(handleSwipeEnd)(event.translationY);
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(onOpenProfile)();
  });

  const gesture = Gesture.Exclusive(pan, tap);

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={styles.hit}
        accessibilityRole="adjustable"
        accessibilityLabel={`Active profile ${label}`}
        accessibilityHint="Swipe up or down on the avatar to switch family profiles. Tap to open profile."
      >
        {avatarBody}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: 'center',
    height: NAV_CHROME.clusterHeight,
    justifyContent: 'center',
    width: NAV_CHROME.clusterHeight,
  },
  avatarWrap: {
    alignItems: 'center',
    height: AVATAR + 8,
    justifyContent: 'center',
    position: 'relative',
    width: AVATAR + 8,
  },
  avatarRing: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: UAE.green,
    borderRadius: AVATAR / 2 + 3,
    borderWidth: 2.5,
    height: AVATAR + 5,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
    width: AVATAR + 5,
  },
  initials: {
    color: UAE.green,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  switchRail: {
    bottom: 4,
    justifyContent: 'space-between',
    position: 'absolute',
    right: 3,
    top: 4,
    width: 3,
  },
  switchTick: {
    borderRadius: 2,
    width: 3,
  },
  switchTickDim: {
    backgroundColor: UAE.green,
    height: 3,
    opacity: 0.35,
  },
  switchTickActive: {
    backgroundColor: UAE.green,
    height: 7,
  },
  switchHint: {
    alignItems: 'center',
    backgroundColor: UAE.green,
    borderColor: UAE.white,
    borderRadius: 9,
    borderWidth: 1.5,
    bottom: 0,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    width: 18,
  },
});
