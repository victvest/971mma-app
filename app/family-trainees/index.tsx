import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar } from '@/shared/components/ui';
import { FamilyTraineesScreenContent } from '@/features/guardian/components/FamilyTraineesScreenContent';
import { useTheme } from '@/shared/theme';

export default function FamilyTraineesScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Family profiles" showBackButton />
      <FamilyTraineesScreenContent />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
