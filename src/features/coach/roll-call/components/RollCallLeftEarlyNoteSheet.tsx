import React, { memo, useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
import { TextField } from '@/shared/components/ui';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  visible: boolean;
  memberName: string;
  onConfirm: (note: string | null) => void;
  onCancel: () => void;
};

export const RollCallLeftEarlyNoteSheet = memo(function RollCallLeftEarlyNoteSheet({
  visible,
  memberName,
  onConfirm,
  onCancel,
}: Props) {
  const { colors, typography, gap } = useTheme();
  const [note, setNote] = useState('');

  const handleConfirm = useCallback(() => {
    triggerLightImpact();
    const trimmed = note.trim();
    onConfirm(trimmed.length > 0 ? trimmed : null);
    setNote('');
  }, [note, onConfirm]);

  const handleCancel = useCallback(() => {
    setNote('');
    onCancel();
  }, [onCancel]);

  return (
    <AppBottomSheet visible={visible} onDismiss={handleCancel}>
      <View style={{ gap: gap.xs }}>
        <Text style={[typography.textPresets.coachSectionTitle, { color: colors.text.primary }]}>
          Left early
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
          {memberName} left before class ended. Add an optional time note for the audit log.
        </Text>
      </View>

      <TextField
        label="Time note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="e.g. 19:35"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <AppBottomSheetButton label="Save left early" onPress={handleConfirm} />
      <AppBottomSheetButton label="Cancel" variant="secondary" onPress={handleCancel} />
    </AppBottomSheet>
  );
});
