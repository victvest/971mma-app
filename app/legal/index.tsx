import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar } from '@/shared/components/ui';
import { LegalScreenContent } from '@/features/legal/components/LegalScreenContent';
import { useTheme } from '@/shared/theme';

export default function LegalScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Legal" showBackButton />
      <LegalScreenContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
