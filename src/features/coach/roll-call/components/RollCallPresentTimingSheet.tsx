import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
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
  const { colors, typography, gap } = useTheme();

  const handleOnTime = useCallback(() => onSelect('present'), [onSelect]);
  const handleLate = useCallback(() => onSelect('late'), [onSelect]);

  return (
    <AppBottomSheet visible={visible} onDismiss={onCancel}>
      <View style={{ gap: gap.xs }}>
        <Text style={[typography.textPresets.coachSectionTitle, { color: colors.text.primary }]}>
          Mark present
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
          {memberName} arrived — on time or late?
        </Text>
      </View>

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

      <AppBottomSheetButton label="Cancel" variant="secondary" onPress={onCancel} />
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  choiceButton: {
    alignItems: 'flex-start',
    borderWidth: 1,
    justifyContent: 'center',
    width: '100%',
  },
});
