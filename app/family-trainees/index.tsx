import React from 'react';
import { StyleSheet } from 'react-native';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { AppBar } from '@/shared/components/ui';
import { FamilyTraineesScreenContent } from '@/features/guardian/components/FamilyTraineesScreenContent';
import { useTheme } from '@/shared/theme';

export default function FamilyTraineesScreen() {
  const { colors } = useTheme();

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Family profiles" showBackButton />
      <FamilyTraineesScreenContent />
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
