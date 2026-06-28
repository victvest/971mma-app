import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { AppScrollView } from '@/shared/components/ui';
import { RevealOnMount } from '@/shared/animations';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import { animations } from '@/shared/theme/animations';
import { useLineage } from '@/features/lineage/hooks/useLineage';
import { LineageFeaturedCard } from '@/features/lineage/components/LineageFeaturedCard';
import { LineageHero } from '@/features/lineage/components/LineageHero';
import { LineageTimelineRow } from '@/features/lineage/components/LineageTimelineRow';

function entranceDelay(index: number): number {
  return Math.min(index, 8) * animations.stagger.base;
}

export function LineageScreenContent() {
  const { inset } = useTheme();
  const lineageQuery = useLineage();

  const [entranceReplayKey, setEntranceReplayKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setEntranceReplayKey((current) => current + 1);
    }, []),
  );

  const contentPadding = useMemo(
    () => ({
      paddingHorizontal: inset.lg,
      paddingTop: 8,
      paddingBottom: inset.xl,
    }),
    [inset.lg, inset.xl],
  );

  const hasError = !!lineageQuery.error;
  const data = lineageQuery.data ?? [];
  const hasData = data.length > 0;
  const listErrorMessage =
    lineageQuery.error instanceof Error
      ? lineageQuery.error.message
      : 'Please check your connection.';

  return (
    <AppScrollView
      contentContainerStyle={contentPadding}
      showsVerticalScrollIndicator={false}
    >
      <RevealOnMount replayKey={entranceReplayKey} delay={entranceDelay(0)}>
        <LineageHero />
      </RevealOnMount>

      {hasError && hasData ? (
        <RevealOnMount replayKey={entranceReplayKey} delay={entranceDelay(1)} style={styles.inlineState}>
          <StateBlock
            kind="error"
            title="Sync issue"
            message="Could not refresh lineage timeline."
            actionLabel="Retry"
            onAction={() => lineageQuery.refetch()}
          />
        </RevealOnMount>
      ) : null}

      {lineageQuery.isLoading ? (
        <RevealOnMount
          replayKey={entranceReplayKey}
          delay={entranceDelay(hasError && hasData ? 2 : 1)}
        >
          <StateBlock kind="loading" title="Loading lineage" />
        </RevealOnMount>
      ) : hasError && !hasData ? (
        <RevealOnMount replayKey={entranceReplayKey} delay={entranceDelay(1)}>
          <StateBlock
            kind="error"
            title="Could not load lineage"
            message={listErrorMessage}
            actionLabel="Retry"
            onAction={() => lineageQuery.refetch()}
          />
        </RevealOnMount>
      ) : !hasError && data.length === 0 ? (
        <RevealOnMount replayKey={entranceReplayKey} delay={entranceDelay(1)}>
          <StateBlock kind="empty" title="No lineage entries yet" />
        </RevealOnMount>
      ) : (
        <>
          <RevealOnMount replayKey={entranceReplayKey} delay={entranceDelay(1)}>
            <LineageFeaturedCard entries={data} />
          </RevealOnMount>

          <View style={styles.timeline}>
            {data.map((entry, index) => (
              <RevealOnMount
                key={entry.id}
                replayKey={entranceReplayKey}
                delay={entranceDelay(index + 2)}
              >
                <LineageTimelineRow
                  entry={entry}
                  isLast={index === data.length - 1}
                  isActive={index === data.length - 1}
                />
              </RevealOnMount>
            ))}
          </View>
        </>
      )}
    </AppScrollView>
  );
}

const styles = StyleSheet.create({
  inlineState: {
    marginBottom: 12,
  },
  timeline: {
    marginTop: 4,
  },
});
