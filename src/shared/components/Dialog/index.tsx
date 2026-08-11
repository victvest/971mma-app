import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDialogStore, type DialogButton, type DialogConfig } from '@/stores/useDialogStore';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
import { triggerLightImpact, triggerMediumImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

function iconForConfig(config: DialogConfig): keyof typeof Ionicons.glyphMap {
  const hasDestructive = config.buttons.some((btn) => btn.variant === 'destructive');
  if (hasDestructive) return 'warning-outline';
  if (config.buttons.length === 1) return 'information-circle-outline';
  return 'help-circle-outline';
}

function sortButtons(buttons: DialogButton[]): DialogButton[] {
  const primary = buttons.find((btn) => btn.variant === 'primary' || btn.variant === 'destructive');
  const others = buttons.filter((btn) => btn !== primary);
  return primary ? [primary, ...others] : buttons;
}

export function DialogProvider() {
  const storeVisible = useDialogStore((s) => s.visible);
  const storeConfig = useDialogStore((s) => s.config);
  const hide = useDialogStore((s) => s.hide);
  const _afterHide = useDialogStore((s) => s._afterHide);
  const pendingActionRef = useRef<(() => void) | undefined>(undefined);

  const configRef = useRef<DialogConfig | null>(null);
  const [localConfig, setLocalConfig] = useState<DialogConfig | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    if (storeVisible && storeConfig) {
      configRef.current = storeConfig;
      setLocalConfig(storeConfig);
      setSheetVisible(true);
    }
  }, [storeConfig, storeVisible]);

  useEffect(() => {
    if (!storeVisible && sheetVisible) {
      setSheetVisible(false);
    }
  }, [sheetVisible, storeVisible]);

  const handleSheetDismissed = useCallback(() => {
    const cfg = configRef.current;
    hide();
    setLocalConfig(null);
    configRef.current = null;
    _afterHide();
    cfg?.onClose?.();

    const action = pendingActionRef.current;
    pendingActionRef.current = undefined;
    if (action) {
      requestAnimationFrame(() => action());
    }
  }, [_afterHide, hide]);

  const handleButtonPress = useCallback(
    (btn: DialogButton) => {
      const variant = btn.variant ?? 'primary';
      if (variant === 'destructive') triggerMediumImpact();
      else triggerLightImpact();

      pendingActionRef.current = btn.onPress;
      hide();
      setSheetVisible(false);
    },
    [hide],
  );

  if (!localConfig) return null;

  const buttons = sortButtons([...localConfig.buttons]);
  const primaryButton = buttons[0];
  const secondaryButtons = buttons.slice(1);

  if (!primaryButton) return null;

  return (
    <AppBottomSheet
      visible={sheetVisible}
      onDismiss={handleSheetDismissed}
      dismissOnBackdropPress={localConfig.dismissOnBackdropPress !== false}
    >
      <DialogSheetContent
        config={localConfig}
        primaryButton={primaryButton}
        secondaryButtons={secondaryButtons}
        onButtonPress={handleButtonPress}
      />
    </AppBottomSheet>
  );
}

type DialogSheetContentProps = {
  config: DialogConfig;
  primaryButton: DialogButton;
  secondaryButtons: DialogButton[];
  onButtonPress: (btn: DialogButton) => void;
};

function DialogSheetContent({
  config,
  primaryButton,
  secondaryButtons,
  onButtonPress,
}: DialogSheetContentProps) {
  const { colors, typography, gap } = useTheme();
  const iconName = iconForConfig(config);

  return (
    <>
      <View style={[styles.iconWrap, { backgroundColor: colors.accent.subtle }]}>
        <Ionicons name={iconName} size={24} color={colors.accent.default} />
      </View>

      <View style={{ gap: gap.xs }}>
        <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>
          {config.title}
        </Text>
        {config.message ? (
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {config.message}
          </Text>
        ) : null}
      </View>

      {config.children ? <View style={styles.customContent}>{config.children}</View> : null}

      <AppBottomSheetButton
        label={primaryButton.label}
        variant={primaryButton.variant ?? 'primary'}
        onPress={() => onButtonPress(primaryButton)}
      />

      {secondaryButtons.map((btn, index) => (
        <AppBottomSheetButton
          key={`${btn.label}-${index}`}
          label={btn.label}
          variant={
            btn.variant === 'primary' || btn.variant === 'destructive' ? btn.variant : 'secondary'
          }
          onPress={() => onButtonPress(btn)}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  customContent: {
    width: '100%',
  },
});

export { useDialog } from './useDialog';
