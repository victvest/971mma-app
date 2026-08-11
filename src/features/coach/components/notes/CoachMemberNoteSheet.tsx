import React, { memo, useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
import { TextField } from '@/shared/components/ui';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';

type Props = {
  visible: boolean;
  memberName: string;
  onConfirm: (note: string) => void;
  onCancel: () => void;
  loading?: boolean;
};

export const CoachMemberNoteSheet = memo(function CoachMemberNoteSheet({
  visible,
  memberName,
  onConfirm,
  onCancel,
  loading = false,
}: Props) {
  const { colors, typography, gap } = useTheme();
  const [note, setNote] = useState('');

  const handleConfirm = useCallback(() => {
    const trimmed = note.trim();
    if (!trimmed || loading) return;
    triggerLightImpact();
    onConfirm(trimmed);
    setNote('');
  }, [loading, note, onConfirm]);

  const handleCancel = useCallback(() => {
    if (loading) return;
    setNote('');
    onCancel();
  }, [loading, onCancel]);

  return (
    <AppBottomSheet visible={visible} onDismiss={handleCancel} dismissOnBackdropPress={!loading}>
      <View style={{ gap: gap.xs }}>
        <Text style={[typography.textPresets.coachSectionTitle, { color: colors.text.primary }]}>
          Post-class note
        </Text>
        <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
          Add a private coaching note for {memberName}. Visible to coaches and admin only.
        </Text>
      </View>

      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="Technique focus, attitude, next steps…"
        multiline
        autoCapitalize="sentences"
      />

      <AppBottomSheetButton
        label={loading ? 'Saving…' : 'Save note'}
        onPress={handleConfirm}
      />
      <AppBottomSheetButton label="Cancel" variant="secondary" onPress={handleCancel} />
    </AppBottomSheet>
  );
});
