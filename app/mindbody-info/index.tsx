import React from 'react';
import { StyleSheet } from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { AppBar } from '@/shared/components/ui';
import { MindbodyInfoScreenContent } from '@/features/profile/components/MindbodyInfoScreenContent';
import { useTheme } from '@/shared/theme';

export default function MindbodyInfoScreen() {
  const { colors } = useTheme();

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Mindbody ID" showBackButton />
      <MindbodyInfoScreenContent />
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
