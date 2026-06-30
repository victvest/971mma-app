import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { BrandedButton, FlashListScrollComponent } from '@/shared/components/ui';
import { AcademyEyebrow } from '@/shared/components/brand';
import { CommunityInboxRow, CommunityInboxSkeleton, CommunityUnreadChip } from '@/features/communities/components';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import type { CommunityChannelItem } from '@/types/domain';

type CommunityInboxScreenProps = {
  channels: CommunityChannelItem[];
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => Promise<unknown>;
  onRetry: () => void;
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyMessage: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  unreadTotal?: number;
};

export function CommunityInboxScreen({
  channels,
  isLoading,
  isError,
  onRefresh,
  onRetry,
  eyebrow,
  title,
  subtitle,
  emptyTitle,
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  unreadTotal = 0,
}: CommunityInboxScreenProps) {
  const { colors, typography, inset, gap } = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh]);

  const sortedChannels = useMemo(
    () =>
      [...channels].sort((left, right) => {
        const unreadDelta = Number(right.unreadCount > 0) - Number(left.unreadCount > 0);
        if (unreadDelta !== 0) return unreadDelta;

        const rightTime = new Date(right.lastMessageAt ?? right.latestPostAt ?? 0).getTime();
        const leftTime = new Date(left.lastMessageAt ?? left.latestPostAt ?? 0).getTime();
        return rightTime - leftTime;
      }),
    [channels],
  );

  const renderItem = useCallback(
    ({ item }: { item: CommunityChannelItem }) => (
      <CommunityInboxRow channel={item} onPress={() => router.push(`/communities/${item.id}`)} />
    ),
    [router],
  );

  const listHeader = useMemo(
    () => (
      <View
        style={[
          styles.hero,
          {
            gap: gap.md,
            paddingHorizontal: inset.lg,
            paddingTop: inset.lg,
            paddingBottom: inset.md,
          },
        ]}
      >
        <View style={{ gap: gap.xs }}>
          <View style={styles.titleRow}>
            <AcademyEyebrow label={eyebrow} accent />
            {unreadTotal > 0 ? <CommunityUnreadChip count={unreadTotal} size="md" /> : null}
          </View>
          <Text
            style={[typography.textPresets.title, styles.title, { color: colors.text.primary }]}
          >
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text>
        </View>
      </View>
    ),
    [colors, eyebrow, gap, inset, subtitle, title, typography, unreadTotal],
  );

  const listEmpty = useMemo(() => {
    if (isLoading) {
      return <CommunityInboxSkeleton />;
    }

    if (isError) {
      return (
        <View style={{ paddingHorizontal: inset.lg }}>
          <StateBlock
            kind="error"
            title="Could not load groups"
            message="Please check your connection and try again."
            actionLabel="Retry"
            onAction={onRetry}
          />
        </View>
      );
    }

    return (
      <View style={{ gap: gap.md, paddingHorizontal: inset.lg }}>
        <StateBlock kind="empty" title={emptyTitle} message={emptyMessage} />
        {emptyActionLabel && onEmptyAction ? (
          <BrandedButton label={emptyActionLabel} onPress={onEmptyAction} />
        ) : null}
      </View>
    );
  }, [
    emptyActionLabel,
    emptyMessage,
    emptyTitle,
    gap.md,
    inset.lg,
    isError,
    isLoading,
    onEmptyAction,
    onRetry,
  ]);

  return (
    <FlashList
      renderScrollComponent={FlashListScrollComponent}
      data={isLoading || isError ? [] : sortedChannels}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      contentContainerStyle={{ paddingBottom: inset.xl }}
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 30,
    letterSpacing: 0,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: 340,
  },
});
