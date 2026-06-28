import React, { memo, useCallback, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

export type RollCallPresentTimingChoice = 'present' | 'late';

type Props = {
  visible: boolean;
  memberName: string;
  onSelect: (choice: RollCallPresentTimingChoice) => void;
  onCancel: () => void;
};

type ChoiceButtonProps = {
  label: string;
  hint: string;
  variant: 'primary' | 'secondary';
  onPress: () => void;
  accessibilityLabel: string;
};

const ChoiceButton = memo(function ChoiceButton({
  label,
  hint,
  variant,
  onPress,
  accessibilityLabel,
}: ChoiceButtonProps) {
  const { colors, inset, radius, typography, gap } = useTheme();

  const handlePress = useCallback(() => {
    triggerLightImpact();
    triggerSuccessNotification();
    onPress();
  }, [onPress]);

  const isPrimary = variant === 'primary';

  return (
    <MotiPressable
      onPress={handlePress}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.choiceButton,
        {
          minHeight: 56,
          borderRadius: radius.button,
          backgroundColor: isPrimary ? colors.accent.default : colors.surface.primary,
          borderColor: isPrimary ? colors.accent.default : colors.border.default,
          paddingHorizontal: inset.lg,
          gap: gap.xs,
        },
      ]}
    >
      <Text
        style={[
          typography.textPresets.button,
          { color: isPrimary ? colors.accent.onAccent : colors.text.primary },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          typography.textPresets.footnote,
          { color: isPrimary ? colors.accent.onAccent : colors.text.secondary },
        ]}
      >
        {hint}
      </Text>
    </MotiPressable>
  );
});

export const RollCallPresentTimingSheet = memo(function RollCallPresentTimingSheet({
  visible,
  memberName,
  onSelect,
  onCancel,
}: Props) {
  const { colors, inset, radius, typography, gap } = useTheme();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      triggerLightImpact();
    }
  }, [visible]);

  const handleOnTime = useCallback(() => onSelect('present'), [onSelect]);
  const handleLate = useCallback(() => onSelect('late'), [onSelect]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.overlay }]}
          onPress={onCancel}
          accessibilityLabel="Cancel present timing"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface.primary,
              borderTopLeftRadius: radius.modal,
              borderTopRightRadius: radius.modal,
              paddingHorizontal: inset.lg,
              paddingTop: inset.lg,
              paddingBottom: insets.bottom + inset.lg,
              gap: gap.md,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border.default }]} />
          <Text style={[typography.textPresets.coachSectionTitle, { color: colors.text.primary }]}>
            Mark present
          </Text>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {memberName} arrived — on time or late?
          </Text>

          <ChoiceButton
            label="On time"
            hint="Counts as present"
            variant="primary"
            onPress={handleOnTime}
            accessibilityLabel="Mark on time"
          />
          <ChoiceButton
            label="Present (late)"
            hint="Arrived after roll call started"
            variant="secondary"
            onPress={handleLate}
            accessibilityLabel="Mark present late"
          />

          <MotiPressable
            onPress={onCancel}
            accessibilityLabel="Cancel"
            style={[styles.cancelButton, { minHeight: 48 }]}
          >
            <Text style={[typography.textPresets.button, { color: colors.text.secondary }]}>
              Cancel
            </Text>
          </MotiPressable>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderWidth: 0,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 999,
    height: 4,
    width: 40,
  },
  choiceButton: {
    alignItems: 'flex-start',
    borderWidth: 1,
    justifyContent: 'center',
    width: '100%',
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
