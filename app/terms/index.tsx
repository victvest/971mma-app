import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar } from '@/shared/components/ui';
import { LegalDocumentView } from '@/features/legal/components/LegalDocumentView';
import { TERMS_DOCUMENT } from '@/features/legal/data/legalContent';
import { useTheme } from '@/shared/theme';

export default function TermsScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Terms & Conditions" showBackButton />
      <LegalDocumentView document={TERMS_DOCUMENT} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
