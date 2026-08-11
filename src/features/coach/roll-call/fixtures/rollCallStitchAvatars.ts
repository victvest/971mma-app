import { Image } from 'react-native';

/** Portrait URLs resolved from local high-quality assets for mock demo members. */
export const ROLL_CALL_STITCH_AVATARS = {
  ahmedAlMansoori: Image.resolveAssetSource(require('../../../../../assets/images/demo/ahmed.png')).uri,
  saraKhalid: Image.resolveAssetSource(require('../../../../../assets/images/demo/sara.png')).uri,
  omarHassan: Image.resolveAssetSource(require('../../../../../assets/images/demo/omar.png')).uri,
  laylaAhmed: Image.resolveAssetSource(require('../../../../../assets/images/demo/layla.png')).uri,
  marcusSilva: Image.resolveAssetSource(require('../../../../../assets/images/demo/marcus.png')).uri,
} as const;

const AVATAR_BY_NORMALIZED_NAME: Record<string, string> = {
  'ahmed al mansoori': ROLL_CALL_STITCH_AVATARS.ahmedAlMansoori,
  'sara khalid': ROLL_CALL_STITCH_AVATARS.saraKhalid,
  'omar hassan': ROLL_CALL_STITCH_AVATARS.omarHassan,
  'layla ahmed': ROLL_CALL_STITCH_AVATARS.laylaAhmed,
  'marcus silva': ROLL_CALL_STITCH_AVATARS.marcusSilva,
  'skyler kim': ROLL_CALL_STITCH_AVATARS.laylaAhmed,
};

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function stitchAvatarForDisplayName(displayName: string): string | null {
  return AVATAR_BY_NORMALIZED_NAME[normalizeDisplayName(displayName)] ?? null;
}

/** Demo deck names aligned with Stitch roll call summary roster. */
export const ROLL_CALL_DEMO_SUMMARY_NAMES = [
  'Ahmed Al Mansoori',
  'Sara Khalid',
  'Omar Hassan',
  'Layla Ahmed',
  'Marcus Silva',
] as const;
