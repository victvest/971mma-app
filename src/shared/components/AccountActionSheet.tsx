import React, { memo, useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ACCOUNT_ACTION_COPY,
  type AccountActionKey,
} from '@/shared/auth/accountActionCopy';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';

type Props = {
  visible: boolean;
  actionKey: AccountActionKey;
  onDismiss: () => void;
};

export const AccountActionSheet = memo(function AccountActionSheet({
  visible,
  actionKey,
  onDismiss,
}: Props) {
  const { colors, typography, radius, inset, gap } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);
  const isAnonymousGuest = role === 'guest' && user === null;
  const copy = ACCOUNT_ACTION_COPY[actionKey];

  useEffect(() => {
    if (visible) {
      triggerLightImpact();
    }
  }, [visible]);

  const exitGuestModeIfNeeded = () => {
    if (role === 'guest') {
      logout();
    }
  };

  const handlePrimaryAction = () => {
    triggerLightImpact();
    onDismiss();
    exitGuestModeIfNeeded();
    if (isAnonymousGuest) {
      router.push('/(auth)/register');
      return;
    }
    router.push('/activation-required');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.overlay }]}
          onPress={onDismiss}
          accessibilityLabel="Dismiss account action sheet"
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface.primary,
              borderTopLeftRadius: radius.modal,
              borderTopRightRadius: radius.modal,
              paddingHorizontal: inset.lg,
              paddingTop: inset.md,
              paddingBottom: insets.bottom + inset.lg,
              gap: gap.md,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border.default }]} />

          <View style={[styles.iconWrap, { backgroundColor: colors.accent.subtle }]}>
            <Ionicons name="sparkles" size={24} color={colors.accent.default} />
          </View>

          <View style={{ gap: gap.xs }}>
            <Text style={[typography.textPresets.title, { color: colors.text.primary }]}>
              {copy.title}
            </Text>
            <Text style={[typography.textPresets.body, { color: colors.text.secondary }]}>
              {isAnonymousGuest ? copy.anonymousDescription : copy.activationDescription}
            </Text>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={handlePrimaryAction}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: colors.accent.default,
                borderRadius: radius.pill,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Text style={[typography.textPresets.button, { color: colors.accent.onAccent }]}>
              {isAnonymousGuest ? 'Join the Academy' : 'Complete Activation'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={styles.cancelButton}
          >
            <Text style={[typography.textPresets.button, { color: colors.text.secondary }]}>
              Not now
            </Text>
          </Pressable>
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
    marginBottom: 4,
    width: 40,
  },
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  primaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 20,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
