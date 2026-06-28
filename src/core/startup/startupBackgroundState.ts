let scheduledUserId: string | null = null;
let completedUserId: string | null = null;

export function getScheduledStartupUserId(): string | null {
  return scheduledUserId;
}

export function setScheduledStartupUserId(userId: string | null): void {
  scheduledUserId = userId;
}

export function isStartupBackgroundWorkComplete(userId: string | null | undefined): boolean {
  return Boolean(userId && completedUserId === userId);
}

export function markStartupBackgroundWorkComplete(userId: string): void {
  completedUserId = userId;
}

export function resetStartupBackgroundState(): void {
  scheduledUserId = null;
  completedUserId = null;
}
