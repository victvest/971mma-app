import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBar } from '@/shared/components/ui';
import { LegalDocumentView } from '@/features/legal/components/LegalDocumentView';
import { PRIVACY_DOCUMENT } from '@/features/legal/data/legalContent';
import { useTheme } from '@/shared/theme';

export default function PrivacyScreen() {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <AppBar title="Privacy Policy" showBackButton />
      <LegalDocumentView document={PRIVACY_DOCUMENT} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
