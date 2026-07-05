import React, { memo, useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

const EXIT_DURATION = 220;

type Props = {
  visible: boolean;
  onDismiss: () => void;
  dismissOnBackdropPress?: boolean;
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export const AppBottomSheet = memo(function AppBottomSheet({
  visible,
  onDismiss,
  dismissOnBackdropPress = true,
  children,
  contentStyle,
}: Props) {
  const { colors, inset, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = React.useState(visible);
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(48);

  const finishDismiss = useCallback(() => {
    setMounted(false);
    onDismiss();
  }, [onDismiss]);

  const playExit = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: EXIT_DURATION, easing: Easing.in(Easing.quad) });
    sheetTranslateY.value = withTiming(
      48,
      { duration: EXIT_DURATION, easing: Easing.in(Easing.quad) },
      (finished) => {
        if (finished) runOnJS(finishDismiss)();
      },
    );
  }, [backdropOpacity, finishDismiss, sheetTranslateY]);

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.value = 0;
      sheetTranslateY.value = 48;
      backdropOpacity.value = withTiming(1, { duration: 240, easing: Easing.out(Easing.quad) });
      sheetTranslateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
      triggerLightImpact();
      return;
    }

    if (mounted) {
      playExit();
    }
  }, [backdropOpacity, mounted, playExit, sheetTranslateY, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const handleBackdropPress = useCallback(() => {
    if (!dismissOnBackdropPress) return;
    playExit();
  }, [dismissOnBackdropPress, playExit]);

  if (!mounted) return null;

  return (
    <Modal transparent statusBarTranslucent visible={mounted} animationType="none" onRequestClose={handleBackdropPress}>
      <View style={styles.overlay}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.overlay }]}
            onPress={handleBackdropPress}
            accessibilityLabel="Dismiss sheet"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              backgroundColor: colors.surface.primary,
              borderTopLeftRadius: radius.modal,
              borderTopRightRadius: radius.modal,
              paddingHorizontal: inset.lg,
              paddingTop: inset.md,
              paddingBottom: insets.bottom + inset.lg,
            },
            contentStyle,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
});

type SheetButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'destructive';
};

export const AppBottomSheetButton = memo(function AppBottomSheetButton({
  label,
  onPress,
  variant = 'primary',
}: SheetButtonProps) {
  const { colors, typography, radius } = useTheme();

  if (variant === 'secondary') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={styles.textButton}
      >
        <Text style={[typography.textPresets.button, { color: colors.text.secondary }]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  const backgroundColor =
    variant === 'destructive' ? colors.status.error : colors.accent.default;
  const foregroundColor =
    variant === 'destructive' ? colors.text.inverse : colors.accent.onAccent;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor,
          borderRadius: radius.pill,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <Text style={[typography.textPresets.button, { color: foregroundColor }]}>{label}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    gap: 16,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    marginBottom: 4,
    width: 40,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
  textButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
