import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppSafeAreaView } from '@/shared/components/AppSafeAreaView';
import { StateBlock } from '@/shared/components/StateBlock';
import { resolveCommunityPostChannelId } from '@/services/database/community.repository';
import { useTheme } from '@/shared/theme';

/**
 * Legacy deep-link target. Group channels are now a flat feed with no
 * per-post thread screen; redirect to the parent channel. Kept (rather than
 * deleted) so existing notification payloads and older app builds pointing
 * at /communities/post/<id> still land somewhere valid.
 */
export default function LegacyCommunityPostRedirect() {
  const { inset } = useTheme();
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const resolvedPostId = typeof postId === 'string' ? postId : '';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const channelId = resolvedPostId
        ? await resolveCommunityPostChannelId(resolvedPostId).catch(() => null)
        : null;
      if (cancelled) return;
      router.replace(channelId ? `/communities/${channelId}` : '/communities');
    })();

    return () => {
      cancelled = true;
    };
  }, [resolvedPostId, router]);

  return (
    <AppSafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.centered, { padding: inset.lg }]}>
        <StateBlock kind="loading" title="Opening..." />
      </View>
    </AppSafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
});
