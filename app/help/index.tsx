import React from 'react';
import { StyleSheet } from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { AppBar } from '@/shared/components/ui';
import { HelpScreenContent } from '@/features/support/components/HelpScreenContent';
import { useTheme } from '@/shared/theme';

export default function HelpScreen() {
  const { colors } = useTheme();

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Help & Support" showBackButton />
      <HelpScreenContent />
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
