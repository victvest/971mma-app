import React, { memo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RollCallMemberStatus } from '@/features/coach/roll-call/types';
import { rollCallStatusDisplayLabel } from '@/features/coach/roll-call/types';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

export type RollCallSummaryEditStatus =
  | Extract<RollCallMemberStatus, 'present' | 'late' | 'absent'>
  | 'left_early';

type Props = {
  visible: boolean;
  memberName: string;
  currentStatus: RollCallMemberStatus | null;
  includeLeftEarly?: boolean;
  onSelect: (status: RollCallSummaryEditStatus) => void;
  onCancel: () => void;
};

type StatusOption = {
  status: RollCallSummaryEditStatus;
  hint: string;
};

const BASE_STATUS_OPTIONS: StatusOption[] = [
  { status: 'present', hint: 'Arrived on time' },
  { status: 'late', hint: 'Arrived after roll call started' },
  { status: 'absent', hint: 'Not in class today' },
];

const LEFT_EARLY_OPTION: StatusOption = {
  status: 'left_early',
  hint: 'Marked present but left before class ended',
};

type ChoiceButtonProps = {
  label: string;
  hint: string;
  selected: boolean;
  onPress: () => void;
};

const ChoiceButton = memo(function ChoiceButton({
  label,
  hint,
  selected,
  onPress,
}: ChoiceButtonProps) {
  const { colors, inset, radius, typography, gap } = useTheme();

  const handlePress = useCallback(() => {
    triggerLightImpact();
    triggerSuccessNotification();
    onPress();
  }, [onPress]);

  return (
    <MotiPressable
      onPress={handlePress}
      accessibilityLabel={`Set status to ${label}`}
      accessibilityState={{ selected }}
      style={[
        styles.choiceButton,
        {
          minHeight: 56,
          borderRadius: radius.button,
          backgroundColor: selected ? colors.accent.default : colors.surface.primary,
          borderColor: selected ? colors.accent.default : colors.border.default,
          paddingHorizontal: inset.lg,
          gap: gap.xs,
        },
      ]}
    >
      <Text
        style={[
          typography.textPresets.button,
          { color: selected ? colors.accent.onAccent : colors.text.primary },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          typography.textPresets.footnote,
          { color: selected ? colors.accent.onAccent : colors.text.secondary },
        ]}
      >
        {hint}
      </Text>
    </MotiPressable>
  );
});

export const RollCallStatusPickerSheet = memo(function RollCallStatusPickerSheet({
  visible,
  memberName,
  currentStatus,
  includeLeftEarly = false,
  onSelect,
  onCancel,
}: Props) {
  const { colors, typography, gap } = useTheme();

  const statusOptions = includeLeftEarly
    ? [...BASE_STATUS_OPTIONS, LEFT_EARLY_OPTION]
    : BASE_STATUS_OPTIONS;

  return (
    <AppBottomSheet visible={visible} onDismiss={onCancel}>
      <View style={{ gap: gap.xs }}>
        <Text style={[typography.textPresets.coachSectionTitle, { color: colors.text.primary }]}>
          Change attendance
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
          {memberName}
        </Text>
      </View>

      {statusOptions.map((option) => (
        <ChoiceButton
          key={option.status}
          label={rollCallStatusDisplayLabel(option.status)}
          hint={option.hint}
          selected={currentStatus === option.status}
          onPress={() => onSelect(option.status)}
        />
      ))}

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
