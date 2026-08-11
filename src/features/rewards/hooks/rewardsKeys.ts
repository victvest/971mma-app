export const pointsKey = (userId: string) => ['points', userId] as const;
export const ledgerKey = (userId: string) => ['points-ledger', userId] as const;
export const milestonesKey = (userId: string) => ['milestones', userId] as const;
export const redemptionsKey = (userId: string) => ['redemptions', userId] as const;
export const catalogKey = ['rewards-catalog'] as const;
export const appSettingsKey = ['app-settings'] as const;
