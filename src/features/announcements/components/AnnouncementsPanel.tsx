import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FlashListScrollComponent } from '@/shared/components/ui';
import { formatLocalDisplay } from '@/core/time/gymTime';
import {
  useAnnouncements,
  useCreateAnnouncement,
} from '@/features/announcements/hooks/useAnnouncements';
import { AnnouncementChannelPicker } from '@/features/announcements/components/AnnouncementChannelPicker';
import {
  DEFAULT_ANNOUNCEMENT_CHANNEL,
  type AnnouncementChannelId,
} from '@/features/announcements/constants';
import { BrandedButton, TextField } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { useTheme } from '@/shared/theme';
import type { AnnouncementItem } from '@/types/domain';

function AnnouncementRow({ item }: { item: AnnouncementItem }) {
  const { colors, typography } = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: colors.background.secondary }]}>
      <Text style={[styles.channel, { color: colors.accent.default }]}>{item.channel}</Text>
      <Text style={[typography.textPresets.body, { color: colors.text.primary }]}>{item.title}</Text>
      <Text style={[styles.body, { color: colors.text.secondary }]}>{item.body}</Text>
      <Text style={[styles.time, { color: colors.text.tertiary }]}>
        {formatLocalDisplay(item.createdAt)}
      </Text>
    </View>
  );
}

function AnnouncementSeparator() {
  return <View style={styles.separator} />;
}

type Props = {
  canPost: boolean;
  contentPadding?: number;
};

export function AnnouncementsPanel({ canPost, contentPadding }: Props) {
  const { colors, typography, inset } = useTheme();
  const resolvedPadding = contentPadding ?? inset.lg;
  const announcementsQuery = useAnnouncements();
  const createMutation = useCreateAnnouncement();

  const [channel, setChannel] = useState<AnnouncementChannelId>(DEFAULT_ANNOUNCEMENT_CHANNEL);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const errorMessage = useMemo(() => {
    const err = createMutation.error;
    if (!err || typeof err !== 'object' || !('message' in err)) return null;
    return String((err as { message: unknown }).message);
  }, [createMutation.error]);

  const handlePost = () => {
    createMutation.mutate(
      { channel, title: title.trim(), body: body.trim() },
      {
        onSuccess: () => {
          setTitle('');
          setBody('');
        },
      },
    );
  };

  const hasError = Boolean(announcementsQuery.error);
  const data = announcementsQuery.data ?? [];
  const hasData = data.length > 0;
  const listErrorMessage =
    announcementsQuery.error instanceof Error
      ? announcementsQuery.error.message
      : 'Please check your connection.';

  const listHeader = (
    <>
      {canPost ? (
        <View style={{ paddingBottom: inset.md }}>
          <AnnouncementChannelPicker value={channel} onChange={setChannel} />
          <View style={{ gap: 10, marginTop: inset.sm }}>
            <TextField label="Title" value={title} onChangeText={setTitle} />
            <TextField label="Message" value={body} onChangeText={setBody} multiline />
            {errorMessage ? (
              <Text style={{ color: colors.status.error, fontSize: 13 }}>{errorMessage}</Text>
            ) : null}
            <BrandedButton
              label="Publish to members"
              onPress={handlePost}
              loading={createMutation.isPending}
              disabled={!title.trim() || !body.trim()}
            />
          </View>
        </View>
      ) : null}
      {hasError && hasData ? (
        <View style={{ marginBottom: inset.sm }}>
          <StateBlock
            kind="error"
            title="Sync issue"
            message="Could not refresh announcements."
            actionLabel="Retry"
            onAction={() => announcementsQuery.refetch()}
          />
        </View>
      ) : null}
    </>
  );

  if (announcementsQuery.isLoading) {
    return (
      <View style={{ flex: 1, paddingHorizontal: resolvedPadding }}>
        {canPost ? listHeader : null}
        <StateBlock kind="loading" title="Loading announcements" />
      </View>
    );
  }

  if (hasError && !hasData) {
    return (
      <View style={{ flex: 1, paddingHorizontal: resolvedPadding, justifyContent: 'center' }}>
        <StateBlock
          kind="error"
          title="Could not load announcements"
          message={listErrorMessage}
          actionLabel="Retry"
          onAction={() => announcementsQuery.refetch()}
        />
      </View>
    );
  }

  if (!hasError && data.length === 0) {
    return (
      <View style={{ flex: 1, paddingHorizontal: resolvedPadding }}>
        {listHeader}
        <StateBlock kind="empty" title="No announcements yet" />
      </View>
    );
  }

  return (
    <FlashList
      renderScrollComponent={FlashListScrollComponent}
      data={data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={listHeader}
      contentContainerStyle={{ paddingHorizontal: resolvedPadding, paddingTop: 8, paddingBottom: inset.xl }}
      ItemSeparatorComponent={AnnouncementSeparator}
      renderItem={({ item }) => <AnnouncementRow item={item} />}
    />
  );
}

const styles = StyleSheet.create({
  separator: { height: 10 },
  row: { borderRadius: 12, gap: 6, padding: 14 },
  channel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  body: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 12, marginTop: 4 },
});
