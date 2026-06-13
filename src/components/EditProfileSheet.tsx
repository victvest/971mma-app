import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '../theme';
import type { MemberProfile, ProfilePatch } from '../types/models';
import { TextField } from './TextField';
import { Button } from './Button';

type Props = {
  visible: boolean;
  profile: MemberProfile | null;
  onClose: () => void;
  onSave: (patch: ProfilePatch) => Promise<void>;
};

export function EditProfileSheet({ visible, profile, onClose, onSave }: Props) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [beltRank, setBeltRank] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setFullName(profile?.fullName ?? '');
      setPhone(profile?.phone ?? '');
      setBeltRank(profile?.beltRank ?? '');
    }
  }, [visible, profile]);

  const submit = async () => {
    setSaving(true);
    await onSave({
      fullName: fullName.trim(),
      phone: phone.trim() || null as any,
      beltRank: beltRank.trim() || null as any,
    });
    setSaving(false);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetWrap}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Edit profile</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.close}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <TextField
            label="Full name"
            icon="person-outline"
            placeholder="Your name"
            autoCapitalize="words"
            value={fullName}
            onChangeText={setFullName}
          />
          <TextField
            label="Phone"
            icon="call-outline"
            placeholder="+971 ..."
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <TextField
            label="Belt rank"
            icon="ribbon-outline"
            placeholder="e.g. White Belt"
            autoCapitalize="words"
            value={beltRank}
            onChangeText={setBeltRank}
          />

          <Button label="Save changes" onPress={submit} loading={saving} style={{ marginTop: spacing.sm }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11,11,12,0.45)',
  },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  title: { ...typography.h2, color: colors.text },
  close: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
