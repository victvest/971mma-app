import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useActiveProfileOptions } from '@/features/guardian/hooks/useGuardian';
import { MemberAvatar } from '@/shared/components/MemberAvatar';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { useActiveProfileStore } from '@/stores/useActiveProfileStore';
import { useTheme } from '@/shared/theme';

type HeaderProfileAvatarProps = {
  label: string;
  avatarUrl?: string | null;
  onOpenProfile: () => void;
};

const SWIPE_THRESHOLD = 28;

export function HeaderProfileAvatar({ label, avatarUrl, onOpenProfile }: HeaderProfileAvatarProps) {
  const { colors, typography, layout, animations } = useTheme();
  const activeMemberId = useActiveMemberId();
  const setActiveUserId = useActiveProfileStore((s) => s.setActiveUserId);
  const { options, hasChildren } = useActiveProfileOptions();

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

  const switchRail = canSwitchProfiles ? (
    <View style={styles.switchRail} pointerEvents="none">
      <View style={[styles.switchTick, { backgroundColor: colors.accent.onAccent, opacity: 0.45 }]} />
      <View style={[styles.switchTick, styles.switchTickActive, { backgroundColor: colors.accent.onAccent }]} />
      <View style={[styles.switchTick, { backgroundColor: colors.accent.onAccent, opacity: 0.45 }]} />
    </View>
  ) : null;

  const avatarBody = (
    <MemberAvatar
      name={label}
      avatarUrl={avatarUrl}
      size={layout.appHeaderAvatar}
      borderWidth={2}
      borderColor={colors.background.elevated}
      backgroundColor={colors.accent.default}
      textColor={colors.accent.onAccent}
      initialsStyle={typography.textPresets.button}
    >
      {switchRail}
    </MemberAvatar>
  );

  if (!canSwitchProfiles) {
    return (
      <Pressable
        onPress={onOpenProfile}
        accessibilityLabel="Open profile"
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? animations.alpha.pressed : animations.alpha.visible,
        })}
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
  switchRail: {
    position: 'absolute',
    right: 3,
    top: 6,
    bottom: 6,
    justifyContent: 'space-between',
    width: 3,
  },
  switchTick: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  switchTickActive: {
    height: 7,
    opacity: 1,
  },
});
