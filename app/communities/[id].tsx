import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { AppBottomSheet, AppBottomSheetButton } from '@/shared/components/AppBottomSheet';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppBar, FlashListScrollComponent } from '@/shared/components/ui';
import {
  CommunityChatComposer,
  CommunityChatLayout,
  CommunityDateSeparator,
  CommunityFeedMessage,
  CommunityFeedSkeleton,
  CommunityGroupsFab,
} from '@/features/communities/components';
import {
  useCommunityChannelFeedInfinite,
  useCommunityChannelHeader,
  useMarkCommunityChannelReadOnFocus,
  usePinCommunityPost,
  usePublishCommunityPost,
  useToggleCommunityReaction,
  useUnpinCommunityPost,
} from '@/features/communities/hooks/useCommunities';
import { useCommunityChannelRealtime } from '@/features/communities/hooks/useCommunityRealtime';
import {
  buildCommunityFeedRowsChronological,
  mergeCommunityFeedPosts,
  type CommunityFeedRow,
} from '@/features/communities/utils/community-feed-rows';
import { useMyCoachRecord } from '@/features/coach/hooks/useMyCoachRecord';
import { useIsViewingChildProfile } from '@/hooks/useActiveMemberId';
import {
  canManageCommunityChannel,
  canPostInCommunityChannel,
} from '@/features/communities/utils/communityPermissions';
import { StateBlock } from '@/shared/components/StateBlock';
import { FLASH_LIST_ESTIMATES, flashListOverrideItemLayout } from '@/shared/constants/flashListEstimates';
import { triggerLightImpact } from '@/shared/haptics';
import { toast } from '@/shared/components/Toast';
import { useTheme } from '@/shared/theme';
import { useAuthStore } from '@/stores/useAuthStore';
import type { CommunityPostItem } from '@/types/domain';

type FeedPostItemProps = {
  post: CommunityPostItem;
  channelId: string;
  readOnly: boolean;
  onLongPress?: (post: CommunityPostItem) => void;
};

const FeedPostItem = memo(function FeedPostItem({
  post,
  channelId,
  readOnly,
  onLongPress,
}: FeedPostItemProps) {
  const reactionMutation = useToggleCommunityReaction(post.id, channelId);

  return (
    <CommunityFeedMessage
      post={post}
      readOnly={readOnly}
      onLongPress={onLongPress ? () => onLongPress(post) : undefined}
      onReact={readOnly ? undefined : (emoji) => reactionMutation.mutate(emoji)}
    />
  );
});

export default function CommunityChannelScreen() {
  const { colors, inset } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const channelId = typeof id === 'string' ? id : '';
  const viewingChild = useIsViewingChildProfile();
  const role = useAuthStore((state) => state.role);
  const { coach } = useMyCoachRecord();
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const listRef = useRef<FlashListRef<CommunityFeedRow>>(null);
  const didInitialScrollRef = useRef(false);

  const headerQuery = useCommunityChannelHeader(channelId, Boolean(channelId));
  const feedQuery = useCommunityChannelFeedInfinite(channelId, Boolean(channelId));
  const publishMutation = usePublishCommunityPost(coach?.id);
  const pinMutation = usePinCommunityPost(channelId, coach?.id);
  const unpinMutation = useUnpinCommunityPost(channelId, coach?.id);
  const [pinSheetPost, setPinSheetPost] = useState<CommunityPostItem | null>(null);

  const isCoachOwner = headerQuery.data?.isCoachOwner ?? false;
  const channelKind = headerQuery.data?.channelKind ?? 'group';
  const isGroupChannel = channelKind === 'group';
  const canCompose = canPostInCommunityChannel(channelKind, role, isCoachOwner, viewingChild);
  const canManageGroup =
    canManageCommunityChannel(role, isCoachOwner, viewingChild) && isGroupChannel;

  useMarkCommunityChannelReadOnFocus(channelId, Boolean(channelId));
  useCommunityChannelRealtime(channelId, Boolean(channelId));

  const posts = useMemo(
    () => mergeCommunityFeedPosts(feedQuery.data?.pages ?? []),
    [feedQuery.data?.pages],
  );
  const feedRows = useMemo(
    () => buildCommunityFeedRowsChronological([...posts].reverse()),
    [posts],
  );

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [channelId]);

  useEffect(() => {
    if (feedRows.length === 0 || feedQuery.isLoading || didInitialScrollRef.current) return;

    didInitialScrollRef.current = true;
    scrollToLatest(false);
  }, [feedQuery.isLoading, feedRows.length, scrollToLatest]);

  const previousCountRef = useRef(0);
  useEffect(() => {
    if (feedRows.length > previousCountRef.current && didInitialScrollRef.current) {
      scrollToLatest(true);
    }
    previousCountRef.current = feedRows.length;
  }, [feedRows.length, scrollToLatest]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([headerQuery.refetch(), feedQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [feedQuery, headerQuery]);

  const handleLongPressPost = useCallback((post: CommunityPostItem) => {
    triggerLightImpact();
    setPinSheetPost(post);
  }, []);

  const handleTogglePin = useCallback(() => {
    if (!pinSheetPost) return;
    if (pinSheetPost.isPinned) {
      unpinMutation.mutate(pinSheetPost.id);
    } else {
      pinMutation.mutate(pinSheetPost.id);
    }
    setPinSheetPost(null);
  }, [pinMutation, pinSheetPost, unpinMutation]);

  const handleOpenSettings = useCallback(() => {
    router.push({
      pathname: '/(coach)/community-groups/[id]/settings',
      params: { id: channelId },
    });
  }, [channelId, router]);

  const handleLoadOlder = useCallback(() => {
    if (!feedQuery.hasNextPage || feedQuery.isFetchingNextPage) return;
    void feedQuery.fetchNextPage();
  }, [feedQuery]);

  const handleSend = useCallback(() => {
    const body = message.trim();
    if (!body || !canCompose) return;

    publishMutation.mutate(
      {
        channelId,
        body,
        postKind: 'announcement',
      },
      {
        onSuccess: () => {
          setMessage('');
          scrollToLatest(true);
        },
        onError: () => {
          toast.error('Could not send', 'Please try again.');
        },
      },
    );
  }, [canCompose, channelId, message, publishMutation, scrollToLatest]);

  const renderItem = useCallback(
    ({ item }: { item: CommunityFeedRow }) => {
      if (item.type === 'date') {
        return <CommunityDateSeparator iso={item.iso} />;
      }

      return (
        <FeedPostItem
          post={item.post}
          channelId={channelId}
          readOnly={viewingChild}
          onLongPress={canManageGroup ? handleLongPressPost : undefined}
        />
      );
    },
    [canManageGroup, channelId, handleLongPressPost, viewingChild],
  );

  const listHeader = useMemo(() => {
    if (!viewingChild) return null;

    return (
      <View
        style={[
          styles.listHeader,
          { gap: inset.sm, paddingBottom: inset.sm, paddingTop: inset.sm },
        ]}
      >
        {viewingChild ? (
          <View
            style={[
              styles.readOnlyNotice,
              {
                backgroundColor: colors.fill.secondary,
                borderColor: colors.border.subtle,
                marginHorizontal: inset.lg,
              },
            ]}
          >
            <Text style={{ color: colors.text.secondary, fontSize: 13, fontWeight: '700' }}>
              Viewing trainee profile - read-only.
            </Text>
          </View>
        ) : null}
      </View>
    );
  }, [
    colors.border.subtle,
    colors.fill.secondary,
    colors.text.secondary,
    inset.lg,
    inset.sm,
    viewingChild,
  ]);

  const listFooter = useMemo(() => {
    if (!feedQuery.isFetchingNextPage) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator color={colors.accent.default} />
      </View>
    );
  }, [colors.accent.default, feedQuery.isFetchingNextPage]);

  const listEmpty = useMemo(() => {
    if (feedQuery.isLoading || headerQuery.isLoading) {
      return <CommunityFeedSkeleton />;
    }

    if (feedQuery.isError || headerQuery.isError) {
      return (
        <View style={{ paddingHorizontal: inset.lg }}>
          <StateBlock
            kind="error"
            title="Could not load group"
            message="Please check your connection and try again."
            actionLabel="Retry"
            onAction={() => {
              void headerQuery.refetch();
              void feedQuery.refetch();
            }}
          />
        </View>
      );
    }

    return (
      <View style={{ paddingHorizontal: inset.lg }}>
        <StateBlock
          kind="empty"
          title={isGroupChannel ? 'No messages yet' : 'No announcements yet'}
          message={
            canCompose
              ? isGroupChannel
                ? 'Be the first to post in this group.'
                : 'Post the first community announcement.'
              : isGroupChannel
                ? 'No messages yet.'
                : 'Your coach has not posted an announcement yet.'
          }
        />
      </View>
    );
  }, [canCompose, feedQuery, headerQuery, inset.lg, isGroupChannel]);

  const screenTitle = headerQuery.data?.title ?? headerQuery.data?.disciplineName ?? 'Group';

  return (
    <AppSafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
      edges={['top']}
    >
      <AppBar
        title={screenTitle}
        showBackButton
        fallbackHref={role === 'coach' ? '/(coach)/communities' : '/communities'}
      />

      <View style={styles.body}>
        <CommunityChatLayout
          onKeyboardShow={() => scrollToLatest(true)}
          list={
            <FlashList
              ref={listRef}
              renderScrollComponent={FlashListScrollComponent}
              data={feedQuery.isLoading || feedQuery.isError ? [] : feedRows}
              overrideItemLayout={flashListOverrideItemLayout(FLASH_LIST_ESTIMATES.communityFeedMessage)}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ListHeaderComponent={listHeader}
              ListFooterComponent={listFooter}
              ListEmptyComponent={listEmpty}
              onStartReached={handleLoadOlder}
              onStartReachedThreshold={0.2}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
              contentContainerStyle={{ paddingBottom: inset.sm, paddingTop: inset.xs }}
            />
          }
          composer={
            <CommunityChatComposer
              value={canCompose ? message : ''}
              onChangeText={setMessage}
              onSend={handleSend}
              sending={publishMutation.isPending}
              readOnly={!canCompose}
              placeholder={
                canCompose
                  ? isGroupChannel
                    ? 'Message group...'
                    : 'Post a community announcement...'
                  : undefined
              }
              readOnlyHint={
                viewingChild
                  ? 'Family view is read-only.'
                  : 'Announcements are posted by your coach.'
              }
            />
          }
        />
        {canManageGroup ? (
          <CommunityGroupsFab
            bottomOffset={72}
            icon="settings-outline"
            accessibilityLabel="Group settings"
            onPress={handleOpenSettings}
          />
        ) : null}
      </View>

      <AppBottomSheet visible={Boolean(pinSheetPost)} onDismiss={() => setPinSheetPost(null)}>
        <View style={[styles.pinSheetRow, { gap: inset.sm }]}>
          <Ionicons
            name={pinSheetPost?.isPinned ? 'pin' : 'pin-outline'}
            size={18}
            color={colors.accent.default}
          />
          <Text style={{ color: colors.text.primary, fontSize: 15, fontWeight: '700' }}>
            {pinSheetPost?.isPinned ? 'Unpin message' : 'Pin message'}
          </Text>
        </View>
        <AppBottomSheetButton
          label={pinSheetPost?.isPinned ? 'Unpin' : 'Pin'}
          onPress={handleTogglePin}
        />
        <AppBottomSheetButton
          label="Cancel"
          variant="secondary"
          onPress={() => setPinSheetPost(null)}
        />
      </AppBottomSheet>
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  body: { flex: 1 },
  listHeader: {
    width: '100%',
  },
  pinSheetRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  readOnlyNotice: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 16,
  },
});
