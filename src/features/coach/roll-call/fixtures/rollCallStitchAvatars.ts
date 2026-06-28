/** Portrait URLs exported from Stitch — Roll Call Summary screen (971 MMA Premium Experience). */
export const ROLL_CALL_STITCH_AVATARS = {
  ahmedAlMansoori:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuB7TIFB0PNRq4FHxtqyfkjQOyEIweExqMeW3FtCq5Vl9UYi4F-ENdFJ0n7epEO4ciUz9uQ_AcqvBmir0q5dT94eno8XMCGXA4kyegE5TPKbwgrE5w7LPpGi-ow837k5Dt5UAkaDUASfhBS6Z1o98h9zmoFpFhFYjvzTREpUpZomdpV28Zvvpg6P_z4njf2V_ajxbNSfpMruJ2BOPzP5Iunuz2vfn5anI6XbaaCYZJehsiRWcPLK4BkEv7Kn3wQs7grUSKDoJi1LMoQi',
  saraKhalid:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAm7jCEDoLcdq5JaZJu7SRkI_zGDle0zQcsiiyHxmGUYJY-2Kgln_7ECDGbn27QOMpYO9NPTkvt-1H0Gj4Gt3uORYcRjOW53qeAVAN9ffW2kRB0XhLCfL6BEXbkwbr-NXHrnSBXvXQvH3_mKTQV7j6ItDVklABpseQn8ewl902WRChlWtQPuCaB4bcYTNRfpVRkNmocvY9Q85KycaXNJge0sv4aznFHPgQBgaqI-1cqEW2h1wWBVu-u19HKXhqTu42UJ18qR6HhVNpx',
  omarHassan:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuBc8qQAIGeSbj4YpEK-JqDUXusfDN6hzzgRNyOfp5d3OvXTdT0GmzfxqMplPM0ClREKfUpYEZTyPg4qy7uC_gUv4AHV1D4MMKWJ12tkjVQQcGdGzUrSr5mFTw-Z2UavgNfGsTaVBAQdZOd1rqS_2PqWjkM05_ToBu9wsMGlzbGzpINY6dP79ZS-7N7cYEf6I2yp-D3O0xJGqfRRfUUkC9sW83D_fAYQRc4X-J3J7-dOb229QE-1f7atd_gh0-agi94KKtgvkBX5lxkY',
  laylaAhmed:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDuBcWWXKCk9Duxp3Lba66c-h5i_KB0wSOWOsQW9MfMYMD13xZ4yw_H2rgy0N56j8XLV7mdBISCQYOZ1reYP0Oln8IzJ2IMhIc_voQFRbbZHoIVlC_vBTBBK4CnM8yYl1_gKti13OrFAI8tkXiEMiNhrPy-Ebo_y-wfMJXkejs12m-pgYsiu-xFewKq2tRn1v--33IiFVwl5wrxa3qoFf68s3Sj-6W5Ai5I39S6N66yJ7wNq4Yv7nvvnylbXjOldto3N-gD_C0bcZZc',
  marcusSilva:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCoYgtthA58-nU7Dsz1fwErKsl_kFAtPAxy_qIETkS2kMJObkqPvbydD8O9bOXDNOqB2ZL3Arv25FsSi3JBOMspW0z6suBxNkin9aIAmtSOQ6Tn9lSKKFD4DX2h_z6PdYUDtEExZuzL88o2rOBS8lSzokp2TsduwmyMzMJ7WJuqSlR4jU0TGHnQCi-ERTGdkffogZhZyY8KTd2Tn8vI55-4IVbmZCDKEgj3vBF-i-pfLrEFFz6YL9QGnYtHu1XMM2woKMcWp4U0Ep-N',
} as const;

const AVATAR_BY_NORMALIZED_NAME: Record<string, string> = {
  'ahmed al mansoori': ROLL_CALL_STITCH_AVATARS.ahmedAlMansoori,
  'sara khalid': ROLL_CALL_STITCH_AVATARS.saraKhalid,
  'omar hassan': ROLL_CALL_STITCH_AVATARS.omarHassan,
  'layla ahmed': ROLL_CALL_STITCH_AVATARS.laylaAhmed,
  'marcus silva': ROLL_CALL_STITCH_AVATARS.marcusSilva,
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
