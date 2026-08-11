import { fetch } from 'expo/fetch';
import * as ImageManipulator from 'expo-image-manipulator';
import { getSupabaseClient } from '@/services/supabase/client';
import type { FeedMediaItem } from '@/features/feed/types';

const FEED_MEDIA_BUCKET = 'feed-media';
const FEED_IMAGE_MAX_EDGE = 1800;
const FEED_IMAGE_QUALITY = 0.82;

export type LocalFeedImage = {
  uri: string;
  width?: number | null;
  height?: number | null;
};

function randomId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

async function prepareFeedImage(image: LocalFeedImage) {
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  const longestEdge = Math.max(width, height);
  const resize =
    longestEdge > FEED_IMAGE_MAX_EDGE
      ? width >= height
        ? { width: FEED_IMAGE_MAX_EDGE }
        : { height: FEED_IMAGE_MAX_EDGE }
      : undefined;

  return ImageManipulator.manipulateAsync(image.uri, resize ? [{ resize }] : [], {
    compress: FEED_IMAGE_QUALITY,
    format: ImageManipulator.SaveFormat.JPEG,
  });
}

export async function uploadFeedImages(
  userId: string,
  images: LocalFeedImage[],
  onProgress?: (completed: number, total: number) => void,
): Promise<FeedMediaItem[]> {
  const client = getSupabaseClient();
  const total = images.length;
  const media: FeedMediaItem[] = [];

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index]!;
    const prepared = await prepareFeedImage(image);
    const response = await fetch(prepared.uri);
    const arrayBuffer = await response.arrayBuffer();
    const id = randomId();
    const path = `${userId}/${id}/image-${index + 1}.jpg`;

    const { error } = await client.storage.from(FEED_MEDIA_BUCKET).upload(path, arrayBuffer, {
      upsert: true,
      contentType: 'image/jpeg',
    });

    if (error) throw error;

    const { data } = client.storage.from(FEED_MEDIA_BUCKET).getPublicUrl(path);
    media.push({
      id,
      type: 'image',
      url: `${data.publicUrl}?v=${Date.now()}`,
      path,
      width: prepared.width,
      height: prepared.height,
    });
    onProgress?.(index + 1, total);
  }

  return media;
}
