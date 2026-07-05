import React from 'react';
import { StyleSheet } from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { AppBar } from '@/shared/components/ui';
import { AboutScreenContent } from '@/features/about/components/AboutScreenContent';
import { useTheme } from '@/shared/theme';

export default function AboutScreen() {
  const { colors } = useTheme();

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="About" showBackButton />
      <AboutScreenContent />
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
