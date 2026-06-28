export const guardianLinksKey = (userId: string) => ['guardian-links', userId] as const;

export const activeProfileSummariesKey = (ownerUserId: string, profileIdsKey: string) =>
  ['active-profile-summaries', ownerUserId, profileIdsKey] as const;
