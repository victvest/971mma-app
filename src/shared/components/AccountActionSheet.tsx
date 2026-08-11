import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ACCOUNT_ACTION_COPY, type AccountActionKey } from '@/shared/auth/accountActionCopy';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
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
  const { colors, typography, gap } = useTheme();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const logout = useAuthStore((state) => state.logout);
  const isAnonymousGuest = role === 'guest' && user === null;
  const pendingActionRef = useRef<(() => void) | undefined>(undefined);
  const [displayedKey, setDisplayedKey] = useState(actionKey);
  const [sheetVisible, setSheetVisible] = useState(visible);

  useEffect(() => {
    if (visible) {
      setDisplayedKey(actionKey);
      setSheetVisible(true);
    } else {
      setSheetVisible(false);
    }
  }, [actionKey, visible]);

  const copy = ACCOUNT_ACTION_COPY[displayedKey];

  const handleSheetDismissed = useCallback(() => {
    const action = pendingActionRef.current;
    pendingActionRef.current = undefined;
    onDismiss();
    if (action) {
      requestAnimationFrame(() => action());
    }
  }, [onDismiss]);

  const requestClose = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const handlePrimaryAction = useCallback(() => {
    triggerLightImpact();
    pendingActionRef.current = () => {
      if (role === 'guest') {
        logout();
      }
      if (isAnonymousGuest) {
        router.push('/(auth)/register');
        return;
      }
      router.push('/activation-required');
    };
    requestClose();
  }, [isAnonymousGuest, logout, requestClose, role, router]);

  return (
    <AppBottomSheet visible={sheetVisible} onDismiss={handleSheetDismissed}>
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

      <AppBottomSheetButton
        label={isAnonymousGuest ? 'Join the Academy' : 'Complete Activation'}
        onPress={handlePrimaryAction}
      />
      <AppBottomSheetButton label="Not now" variant="secondary" onPress={requestClose} />
    </AppBottomSheet>
  );
});

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
