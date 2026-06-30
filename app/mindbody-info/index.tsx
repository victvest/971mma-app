import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar } from '@/shared/components/ui';
import { MindbodyInfoScreenContent } from '@/features/profile/components/MindbodyInfoScreenContent';
import { useTheme } from '@/shared/theme';

export default function MindbodyInfoScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Mindbody ID" showBackButton />
      <MindbodyInfoScreenContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
