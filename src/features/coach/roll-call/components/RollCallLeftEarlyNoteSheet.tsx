import React, { memo, useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { NativeButton, TextField } from '@/shared/components/ui';
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
  const { colors, inset, radius, typography, gap } = useTheme();
  const insets = useSafeAreaInsets();
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.overlay }]}
          onPress={handleCancel}
          accessibilityLabel="Cancel left early note"
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
            Left early
          </Text>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            {memberName} left before class ended. Add an optional time note for the audit log.
          </Text>

          <TextField
            label="Time note (optional)"
            value={note}
            onChangeText={setNote}
            placeholder="e.g. 19:35"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <NativeButton label="Save left early" onPress={handleConfirm} full />
          <MotiPressable
            onPress={handleCancel}
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
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
