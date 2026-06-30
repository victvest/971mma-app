import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { LegalDocumentView } from '@/features/legal/components/LegalDocumentView';
import { LegalTabToggle, type LegalTab } from '@/features/legal/components/LegalTabToggle';
import { PRIVACY_DOCUMENT, TERMS_DOCUMENT } from '@/features/legal/data/legalContent';
import { RevealOnMount } from '@/shared/animations';
import { useTheme } from '@/shared/theme';

function parseInitialTab(tabParam: string | string[] | undefined): LegalTab {
  const value = Array.isArray(tabParam) ? tabParam[0] : tabParam;
  return value === 'terms' ? 'terms' : 'privacy';
}

export function LegalScreenContent() {
  const { inset } = useTheme();
  const { tab: tabParam } = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<LegalTab>(() => parseInitialTab(tabParam));

  useEffect(() => {
    setTab(parseInitialTab(tabParam));
  }, [tabParam]);

  const handleTabChange = useCallback((next: LegalTab) => {
    setTab(next);
  }, []);

  const document = tab === 'privacy' ? PRIVACY_DOCUMENT : TERMS_DOCUMENT;

  return (
    <View style={styles.flex}>
      <View style={{ paddingHorizontal: inset.lg, paddingTop: inset.sm, paddingBottom: inset.md }}>
        <LegalTabToggle tab={tab} onTabChange={handleTabChange} />
      </View>
      <RevealOnMount replayKey={tab} style={styles.flex}>
        <LegalDocumentView document={document} />
      </RevealOnMount>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
