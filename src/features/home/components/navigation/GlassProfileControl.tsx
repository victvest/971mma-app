import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useActiveProfileOptions } from '@/features/guardian/hooks/useGuardian';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { useActiveProfileStore } from '@/stores/useActiveProfileStore';
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

  const avatarBody = (
    <View style={styles.avatarRing}>
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
});
