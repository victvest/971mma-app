import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppBar, AppScrollView, Button } from '@/shared/components/ui';
import { StateBlock } from '@/shared/components/StateBlock';
import { toast } from '@/shared/components/Toast';
import { triggerLightImpact, triggerSuccessNotification } from '@/shared/haptics';
import { useTheme } from '@/shared/theme';
import { toUserFacingErrorMessage } from '@/lib/userFacingError';
import { useAuthStore } from '@/stores/useAuthStore';
import { FeedDisciplineFilter } from '@/features/feed/components/FeedDisciplineFilter';
import { useCreateFeedPost, useFeedDisciplines } from '@/features/feed/hooks/useFeed';
import { uploadFeedImages, type LocalFeedImage } from '@/features/feed/services/feedMediaUpload';

const MAX_POST_CHARS = 1000;
const MAX_IMAGES = 4;

export function CreatePostScreen() {
  const { colors, typography, inset, gap, radius, layout } = useTheme();
  const safeInsets = useSafeAreaInsets();
  const router = useRouter();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const disciplinesQuery = useFeedDisciplines();
  const createMutation = useCreateFeedPost();
  const [body, setBody] = useState('');
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string | null>(null);
  const [images, setImages] = useState<LocalFeedImage[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );

  const disciplines = disciplinesQuery.data ?? [];
  const trimmedBody = body.trim();
  const remaining = MAX_POST_CHARS - body.length;
  const canPublish =
    Boolean(userId) &&
    Boolean(selectedDisciplineId) &&
    trimmedBody.length > 0 &&
    body.length <= MAX_POST_CHARS &&
    !createMutation.isPending &&
    !uploadProgress;

  useEffect(() => {
    if (selectedDisciplineId || disciplines.length === 0) return;
    setSelectedDisciplineId(disciplines[0]!.id);
  }, [disciplines, selectedDisciplineId]);

  const pickImages = useCallback(async () => {
    triggerLightImpact();
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Photo access needed', 'Allow photo access to attach images.');
      return;
    }

    const slots = MAX_IMAGES - images.length;
    if (slots <= 0) {
      toast.info('Image limit reached', 'You can attach up to 4 images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: slots,
      quality: 0.9,
    });

    if (result.canceled) return;
    const next = result.assets
      .filter((asset) => Boolean(asset.uri))
      .slice(0, slots)
      .map((asset) => ({ uri: asset.uri, width: asset.width, height: asset.height }));
    setImages((current) => [...current, ...next].slice(0, MAX_IMAGES));
  }, [images.length]);

  const removeImage = useCallback((uri: string) => {
    setImages((current) => current.filter((image) => image.uri !== uri));
  }, []);

  const handlePublish = useCallback(async () => {
    if (!canPublish || !userId || !selectedDisciplineId) return;
    triggerLightImpact();

    try {
      const media = images.length
        ? await uploadFeedImages(userId, images, (completed, total) => {
            setUploadProgress({ completed, total });
          })
        : [];

      await createMutation.mutateAsync({
        disciplineId: selectedDisciplineId,
        body: trimmedBody,
        media,
      });
      triggerSuccessNotification();
      toast.success('Posted', 'Your post is live in the feed.');
      router.back();
    } catch (error) {
      toast.error(
        'Could not publish',
        toUserFacingErrorMessage(error, { fallback: 'Please try again.' }),
      );
    } finally {
      setUploadProgress(null);
    }
  }, [body, canPublish, createMutation, images, router, selectedDisciplineId, trimmedBody, userId]);

  const progressText = useMemo(() => {
    if (!uploadProgress) return null;
    return `Uploading ${uploadProgress.completed}/${uploadProgress.total}`;
  }, [uploadProgress]);

  if (!userId) {
    return (
      <View style={[styles.safe, { backgroundColor: colors.background.primary }]}>
        <AppBar title="New post" floating />
        <View style={[styles.centered, { padding: inset.lg }]}>
          <StateBlock
            kind="empty"
            title="Sign in required"
            message="Use your academy account to post in the feed."
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
    >
      <AppBar title="New post" floating />
      <AppScrollView
        contentContainerStyle={{
          paddingHorizontal: inset.lg,
          paddingTop: 104,
          paddingBottom: safeInsets.bottom + 124,
          gap: gap.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: gap.sm }}>
          <Text style={[typography.textPresets.screenEyebrow, { color: colors.text.tertiary }]}>
            Discipline
          </Text>
          <FeedDisciplineFilter
            disciplines={disciplines}
            selectedId={selectedDisciplineId}
            showAllOption={false}
            onSelect={(id) => {
              if (id) setSelectedDisciplineId(id);
            }}
          />
        </View>

        <View
          style={[
            styles.composer,
            {
              borderRadius: radius.card,
              borderColor: colors.border.subtle,
              borderWidth: layout.borderWidth,
              backgroundColor: colors.surface.primary,
              padding: inset.md,
            },
          ]}
        >
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Share a training note, question, or class moment..."
            placeholderTextColor={colors.text.tertiary}
            multiline
            maxLength={MAX_POST_CHARS}
            textAlignVertical="top"
            style={[typography.textPresets.body, styles.input, { color: colors.text.primary }]}
          />
          <View style={styles.composerFooter}>
            <Text
              style={[
                typography.textPresets.captionMedium,
                { color: remaining < 80 ? colors.status.warning : colors.text.tertiary },
              ]}
            >
              {remaining}
            </Text>
            <Pressable
              onPress={pickImages}
              accessibilityRole="button"
              accessibilityLabel="Attach images"
              style={[
                styles.attachButton,
                {
                  borderRadius: radius.pill,
                  backgroundColor: colors.accent.subtle,
                },
              ]}
            >
              <Ionicons name="image-outline" size={18} color={colors.accent.default} />
              <Text
                style={[typography.textPresets.captionMedium, { color: colors.accent.default }]}
              >
                {images.length}/{MAX_IMAGES}
              </Text>
            </Pressable>
          </View>
        </View>

        {images.length > 0 ? (
          <View style={[styles.previewGrid, { gap: gap.sm }]}>
            {images.map((image) => (
              <View
                key={image.uri}
                style={[
                  styles.previewTile,
                  {
                    borderRadius: radius.thumbnail,
                    backgroundColor: colors.surface.secondary,
                  },
                ]}
              >
                <Image
                  source={{ uri: image.uri }}
                  style={styles.previewImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <Pressable
                  onPress={() => removeImage(image.uri)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove image"
                  style={[
                    styles.removeButton,
                    { backgroundColor: colors.background.overlay, borderRadius: radius.pill },
                  ]}
                >
                  <Ionicons name="close" size={16} color={colors.text.inverse} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </AppScrollView>

      <View
        style={[
          styles.publishBar,
          {
            backgroundColor: colors.background.primary,
            borderTopColor: colors.border.subtle,
            paddingHorizontal: inset.lg,
            paddingTop: inset.md,
            paddingBottom: safeInsets.bottom + inset.md,
          },
        ]}
      >
        {progressText ? (
          <View style={{ gap: gap.xs }}>
            <Text style={[typography.textPresets.captionMedium, { color: colors.text.secondary }]}>
              {progressText}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.fill.secondary }]}>
              <View
                style={[
                  styles.progress,
                  {
                    width: `${Math.max(8, (uploadProgress!.completed / uploadProgress!.total) * 100)}%`,
                    backgroundColor: colors.accent.default,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}
        <Button
          label="Publish"
          icon="paper-plane"
          loading={createMutation.isPending || Boolean(uploadProgress)}
          disabled={!canPublish}
          onPress={handlePublish}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: 'center',
  },
  composer: {
    minHeight: 210,
  },
  input: {
    minHeight: 148,
    padding: 0,
  },
  composerFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  attachButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  previewTile: {
    aspectRatio: 1,
    overflow: 'hidden',
    position: 'relative',
    width: '48%',
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  removeButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    right: 8,
    top: 8,
    width: 28,
  },
  publishBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  track: {
    borderRadius: 99,
    height: 6,
    overflow: 'hidden',
  },
  progress: {
    borderRadius: 99,
    height: '100%',
  },
});
