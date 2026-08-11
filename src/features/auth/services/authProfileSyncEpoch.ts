let profileSyncEpoch = 0;

export function invalidateAuthProfileSync(): void {
  profileSyncEpoch += 1;
}

export function nextAuthProfileSyncEpoch(): number {
  profileSyncEpoch += 1;
  return profileSyncEpoch;
}

export function getAuthProfileSyncEpoch(): number {
  return profileSyncEpoch;
}
