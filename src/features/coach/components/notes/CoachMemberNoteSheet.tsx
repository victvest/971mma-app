import React, { memo, useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MotiPressable } from '@/shared/animations/MotiPressable';
import { BrandedButton, TextField } from '@/shared/components/ui';
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
  const { colors, inset, radius, typography, gap } = useTheme();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState('');

  const handleConfirm = useCallback(() => {
    const trimmed = note.trim();
    if (!trimmed) return;
    triggerLightImpact();
    onConfirm(trimmed);
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
          accessibilityLabel="Cancel member note"
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
            Post-class note
          </Text>
          <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
            Add a private coaching note for {memberName}. Visible to coaches and admin only.
          </Text>

          <TextField
            label="Note"
            value={note}
            onChangeText={setNote}
            placeholder="Technique focus, attitude, next steps…"
            multiline
            autoCapitalize="sentences"
          />

          <BrandedButton
            label="Save note"
            onPress={handleConfirm}
            full
            loading={loading}
            disabled={!note.trim() || loading}
          />
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
