import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScrollView, Button, TextField } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { RevealOnMount } from '@/shared/animations';
import { toast } from '@/shared/components/Toast';
import { triggerLightImpact } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useAuthProfile } from '@/features/profile/hooks/useProfile';
import { useUpdateProfile } from '@/features/profile/hooks/useUpdateProfile';
import { uploadAvatar } from '@/features/profile/services/avatarUpload';
import {
  initialsFromName,
  validateOnboardingName,
} from '@/features/onboarding/services/onboardingValidation';
import type { ProfilePatch } from '@/types/domain';

function validatePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^[+]?[\d\s().-]{6,20}$/.test(trimmed)) {
    return 'Enter a valid phone number.';
  }
  return null;
}

export function EditProfileScreenContent() {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();

  const userId = useAuthStore((s) => s.user?.id);
  const email = useAuthStore((s) => s.user?.email);

  const profileQuery = useAuthProfile();
  const profile = profileQuery.data;
  const updateMutation = useUpdateProfile(userId);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pickedAvatar, setPickedAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (profile && !initialized.current) {
      setFullName(profile.fullName ?? '');
      setPhone(profile.phone ?? '');
      initialized.current = true;
    }
  }, [profile]);

  const nameError = useMemo(() => validateOnboardingName(fullName), [fullName]);
  const phoneError = useMemo(() => validatePhone(phone), [phone]);

  const isDirty = useMemo(() => {
    if (!profile) return false;
    const nameChanged = fullName.trim() !== (profile.fullName ?? '').trim();
    const phoneChanged = phone.trim() !== (profile.phone ?? '').trim();
    const avatarChanged = pickedAvatar !== null;
    return nameChanged || phoneChanged || avatarChanged;
  }, [profile, fullName, phone, pickedAvatar]);

  const canSave = isDirty && !nameError && !phoneError && !saving;

  const displayAvatar = pickedAvatar ?? profile?.avatarUrl ?? null;
  const initials = useMemo(() => initialsFromName(fullName || profile?.fullName || 'M'), [fullName, profile?.fullName]);

  const pickAvatar = useCallback(async () => {
    triggerLightImpact();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Photo access needed', 'Allow photo access to change your picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setPickedAvatar(result.assets[0].uri);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!canSave || !userId || !profile) return;

    if (nameError) {
      toast.error('Check your name', nameError);
      return;
    }
    if (phoneError) {
      toast.error('Check your phone', phoneError);
      return;
    }

    triggerLightImpact();
    setSaving(true);
    try {
      const patch: ProfilePatch = {};

      if (fullName.trim() !== (profile.fullName ?? '').trim()) {
        patch.fullName = fullName.trim();
      }
      if (phone.trim() !== (profile.phone ?? '').trim()) {
        patch.phone = phone.trim() || null;
      }
      if (pickedAvatar) {
        patch.avatarUrl = await uploadAvatar(userId, pickedAvatar);
      }

      await updateMutation.mutateAsync(patch);

      toast.success('Profile updated', 'Your changes have been saved.');
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save your changes.';
      toast.error('Update failed', message);
    } finally {
      setSaving(false);
    }
  }, [
    canSave,
    userId,
    profile,
    nameError,
    phoneError,
    fullName,
    phone,
    pickedAvatar,
    updateMutation,
    router,
  ]);

  if (profileQuery.isLoading && !profile) {
    return (
      <View style={[styles.center, { paddingTop: inset['3xl'] }]}>
        <StateBlock kind="loading" title="Loading profile" message="Just a moment…" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { paddingTop: inset['3xl'] }]}>
        <StateBlock
          kind="error"
          title="Could not load profile"
          message="Please go back and try again."
          actionLabel="Retry"
          onAction={() => profileQuery.refetch()}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
    >
      <AppScrollView
        style={styles.flex}
        contentContainerStyle={{
          paddingHorizontal: inset.lg,
          paddingTop: inset.lg,
          paddingBottom: inset['3xl'],
          gap: gap.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <RevealOnMount delay={0} style={styles.avatarBlock}>
          <Pressable
            onPress={pickAvatar}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={styles.avatarAnchor}
          >
            <View
              style={[
                styles.avatarCircle,
                {
                  borderRadius: radius.avatar,
                  borderColor: colors.accent.default,
                  borderWidth: layout.borderWidthStrong,
                  backgroundColor: displayAvatar ? colors.background.elevated : colors.accent.subtle,
                },
              ]}
            >
              {displayAvatar ? (
                <Image
                  source={{ uri: displayAvatar }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={120}
                />
              ) : (
                <Text style={[typography.textPresets.title, { color: colors.accent.default }]}>
                  {initials}
                </Text>
              )}
            </View>
            <View
              style={[
                styles.cameraBadge,
                {
                  backgroundColor: colors.accent.default,
                  borderRadius: radius.pill,
                  borderColor: colors.background.primary,
                },
              ]}
            >
              <Ionicons name="camera" size={16} color={colors.accent.onAccent} />
            </View>
          </Pressable>
          <Text style={[typography.textPresets.footnote, { color: colors.text.tertiary }]}>
            Tap to change your photo
          </Text>
        </RevealOnMount>

        {/* Fields */}
        <RevealOnMount delay={90} style={{ gap: gap.xs }}>
          <TextField
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            icon="person-outline"
            error={nameError ?? undefined}
          />

          <TextField
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            placeholder="e.g. +971 50 123 4567"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            icon="call-outline"
            hint="Optional — helps the academy reach you."
            error={phoneError ?? undefined}
          />
        </RevealOnMount>

      </AppScrollView>

      {/* Sticky save bar */}
      <View
        style={[
          styles.saveBar,
          {
            backgroundColor: colors.background.primary,
            borderTopColor: colors.border.subtle,
            paddingHorizontal: inset.lg,
            paddingTop: inset.md,
            paddingBottom: safeInsets.bottom + inset.md,
          },
        ]}
      >
        <Button
          label={isDirty ? 'Save changes' : 'No changes to save'}
          icon="checkmark"
          onPress={handleSave}
          loading={saving}
          disabled={!canSave}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, paddingHorizontal: 24 },
  avatarBlock: {
    alignItems: 'center',
    gap: 10,
  },
  avatarAnchor: {
    height: 116,
    position: 'relative',
    width: 116,
  },
  avatarCircle: {
    alignItems: 'center',
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  cameraBadge: {
    alignItems: 'center',
    borderWidth: 2,
    bottom: 0,
    height: 36,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 36,
  },
  saveBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
