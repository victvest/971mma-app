import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { BrandedButton, FlashListScrollComponent } from '@/shared/components/ui';
import { AcademyEyebrow } from '@/shared/components/brand';
import {
  CommunityInboxRow,
  CommunityInboxSkeleton,
} from '@/features/communities/components';
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
          { gap: gap.xs, paddingHorizontal: inset.lg, paddingTop: inset.lg, paddingBottom: inset.md },
        ]}
      >
        <AcademyEyebrow label={eyebrow} accent />
        <Text style={[typography.textPresets.homeHero, { color: colors.text.primary, lineHeight: 42 }]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>{subtitle}</Text>
      </View>
    ),
    [colors, eyebrow, gap, inset, subtitle, title, typography],
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
  }, [emptyActionLabel, emptyMessage, emptyTitle, gap.md, inset.lg, isError, isLoading, onEmptyAction, onRetry]);

  return (
    <FlashList
      renderScrollComponent={FlashListScrollComponent}
      data={isLoading || isError ? [] : channels}
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
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    maxWidth: 340,
  },
});
