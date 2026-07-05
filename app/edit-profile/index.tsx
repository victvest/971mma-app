import React from 'react';
import { StyleSheet } from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { AppBar } from '@/shared/components/ui';
import { EditProfileScreenContent } from '@/features/profile/components/EditProfileScreenContent';
import { useTheme } from '@/shared/theme';

export default function EditProfileScreen() {
  const { colors } = useTheme();

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar title="Edit Profile" showBackButton />
      <EditProfileScreenContent />
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
