import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useDialogStore, type DialogButton, type DialogButtonVariant, type DialogConfig } from '@/stores/useDialogStore';
import { triggerLightImpact, triggerMediumImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

const DIALOG_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 340);

// How long the exit animation takes (ms) — must match withTiming duration below
const EXIT_DURATION = 160;

// ─── Button color / weight maps ────────────────────────────────────────────────
const BUTTON_COLOR: Record<
  DialogButtonVariant,
  (colors: ReturnType<typeof useTheme>['colors']) => string
> = {
  primary: (c) => c.accent.default,
  secondary: (c) => c.text.secondary,
  destructive: (c) => c.status.error,
};

const BUTTON_WEIGHT: Record<DialogButtonVariant, '400' | '600' | '700'> = {
  primary: '700',
  secondary: '400',
  destructive: '700',
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function DialogProvider() {
  const storeVisible = useDialogStore((s) => s.visible);
  const storeConfig = useDialogStore((s) => s.config);
  const hide = useDialogStore((s) => s.hide);
  const _afterHide = useDialogStore((s) => s._afterHide);
  const pendingActionRef = useRef<(() => void) | undefined>(undefined);

  // Keep a local copy of config so it stays available during the exit animation
  // (store nulls it out via _afterHide right after hide())
  const configRef = useRef<DialogConfig | null>(null);
  const [localConfig, setLocalConfig] = useState<DialogConfig | null>(null);

  // Modal-level mounted state — stays true a bit longer than storeVisible
  const [modalMounted, setModalMounted] = useState(false);

  // Animation shared values
  const backdropOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.88);
  const cardOpacity = useSharedValue(0);
  const cardTranslateY = useSharedValue(16);

  const playEnter = useCallback(() => {
    backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    cardOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
    cardScale.value = withSpring(1, { damping: 22, stiffness: 350, mass: 0.75 });
    cardTranslateY.value = withSpring(0, { damping: 22, stiffness: 350, mass: 0.75 });
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const playExit = useCallback((onDone: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: EXIT_DURATION, easing: Easing.in(Easing.quad) });
    cardOpacity.value = withTiming(0, { duration: EXIT_DURATION, easing: Easing.in(Easing.quad) });
    cardScale.value = withTiming(0.92, { duration: EXIT_DURATION, easing: Easing.in(Easing.quad) });
    cardTranslateY.value = withTiming(12, { duration: EXIT_DURATION, easing: Easing.in(Easing.quad) }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  }, [backdropOpacity, cardOpacity, cardScale, cardTranslateY]);

  const unmountAfterExit = useCallback(() => {
    setModalMounted(false);
    setLocalConfig(null);
    configRef.current = null;
    _afterHide();
    const action = pendingActionRef.current;
    pendingActionRef.current = undefined;
    if (action) {
      requestAnimationFrame(() => action());
    }
  }, [_afterHide]);

  useEffect(() => {
    if (storeVisible && storeConfig) {
      // Reset animation values before mount
      backdropOpacity.value = 0;
      cardScale.value = 0.88;
      cardOpacity.value = 0;
      cardTranslateY.value = 16;
      // Capture config and mount modal
      configRef.current = storeConfig;
      setLocalConfig(storeConfig);
      setModalMounted(true);
      // Play enter on next frame so modal is rendered first
      requestAnimationFrame(playEnter);
    } else if (!storeVisible && modalMounted) {
      playExit(unmountAfterExit);
    }
    // Stable animation refs intentionally excluded from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeVisible, storeConfig]);

  const handleBackdropPress = useCallback(() => {
    const cfg = configRef.current;
    if (cfg?.dismissOnBackdropPress === false) return;
    hide();
    cfg?.onClose?.();
  }, [hide]);

  const handleButtonPress = useCallback((btn: DialogButton) => {
    const variant = btn.variant ?? 'primary';
    if (variant === 'destructive') triggerMediumImpact();
    else triggerLightImpact();
    pendingActionRef.current = btn.onPress;
    hide();
  }, [hide]);

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { scale: cardScale.value },
      { translateY: cardTranslateY.value },
    ],
  }));

  if (!modalMounted || !localConfig) return null;

  const hasTwoButtons = localConfig.buttons.length === 2;

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={modalMounted}
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Backdrop */}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
          pointerEvents="auto"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress} />
        </Animated.View>

        {/* Centered card */}
        <View style={styles.centeredContainer} pointerEvents="box-none">
          <Animated.View style={[styles.dialogWrapper, cardStyle]}>
            <DialogCard
              config={localConfig}
              hasTwoButtons={hasTwoButtons}
              onButtonPress={handleButtonPress}
            />
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Dialog card ──────────────────────────────────────────────────────────────
type DialogCardProps = {
  config: DialogConfig;
  hasTwoButtons: boolean;
  onButtonPress: (btn: DialogButton) => void;
};

function DialogCard({ config, hasTwoButtons, onButtonPress }: DialogCardProps) {
  const { colors, typography, radius } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          borderRadius: radius.modal,
          backgroundColor: colors.background.elevated,
          borderColor: colors.border.subtle,
        },
      ]}
    >
      <View style={styles.contentArea}>
        <Text
          style={[
            typography.textPresets.subtitle,
            styles.title,
            { color: colors.text.primary },
          ]}
        >
          {config.title}
        </Text>

        {config.message ? (
          <Text
            style={[
              typography.textPresets.body,
              styles.message,
              { color: colors.text.secondary },
            ]}
          >
            {config.message}
          </Text>
        ) : null}

        {config.children ? (
          <View style={styles.customContent}>{config.children}</View>
        ) : null}
      </View>

      <View style={[styles.separator, { backgroundColor: colors.border.subtle }]} />

      <View style={[styles.buttonRow, hasTwoButtons && styles.buttonRowSplit]}>
        {(config.buttons as DialogButton[]).map((btn, idx) => {
          const variant = btn.variant ?? 'primary';
          const color = BUTTON_COLOR[variant](colors);
          const weight = BUTTON_WEIGHT[variant];
          const isDestructive = variant === 'destructive';

          return (
            <React.Fragment key={idx}>
              {hasTwoButtons && idx === 1 ? (
                <View style={[styles.buttonDivider, { backgroundColor: colors.border.subtle }]} />
              ) : null}
              <ButtonRow
                label={btn.label}
                color={color}
                weight={weight}
                isDestructive={isDestructive}
                hasTwoButtons={hasTwoButtons}
                onPress={() => onButtonPress(btn)}
                accentColor={colors.status.errorSubtle}
              />
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

// ─── Button row with press animation ─────────────────────────────────────────
type ButtonRowProps = {
  label: string;
  color: string;
  weight: '400' | '600' | '700';
  isDestructive: boolean;
  hasTwoButtons: boolean;
  onPress: () => void;
  accentColor: string;
};

function ButtonRow({ label, color, weight, isDestructive, hasTwoButtons, onPress, accentColor }: ButtonRowProps) {
  const { typography } = useTheme();
  const pressed = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [1, 0.6]),
    backgroundColor: isDestructive
      ? `rgba(232, 25, 44, ${interpolate(pressed.value, [0, 1], [0, 0.08])})`
      : `transparent`,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 80 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 18, stiffness: 400 });
      }}
      style={[styles.button, hasTwoButtons && styles.buttonHalf]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, pressStyle]} />
      <Text
        style={[
          typography.textPresets.callout,
          { color, fontWeight: weight },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogWrapper: {
    width: DIALOG_WIDTH,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 0.5,
  },
  contentArea: {
    paddingTop: 28,
    paddingHorizontal: 22,
    paddingBottom: 22,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  customContent: {
    width: '100%',
    marginTop: 16,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'column',
  },
  buttonRowSplit: {
    flexDirection: 'row',
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  buttonHalf: {
    flex: 1,
  },
  buttonDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
  },
});

export { useDialog } from './useDialog';
