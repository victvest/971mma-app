import * as ImageManipulator from 'expo-image-manipulator';

/** Max edge length — covers 3× profile hero (320pt) with headroom. */
const AVATAR_MAX_EDGE = 1024;
const AVATAR_JPEG_QUALITY = 0.82;

/**
 * Resize and compress a picked avatar before upload so payloads stay bounded on slow networks.
 * Output is always JPEG regardless of the picker source format.
 */
export async function prepareAvatarForUpload(localUri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: AVATAR_MAX_EDGE } }],
    {
      compress: AVATAR_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );
  return result.uri;
}
