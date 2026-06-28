import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function runHaptic(task: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  void task().catch(() => undefined);
}

export function triggerSelectionHaptic(): void {
  runHaptic(() => Haptics.selectionAsync());
}

export function triggerLightImpact(): void {
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function triggerMediumImpact(): void {
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function triggerSuccessNotification(): void {
  runHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Fire light impact when the user initiates pull-to-refresh. */
export function withRefreshHaptic(handler: () => void | Promise<void>): () => void {
  return () => {
    triggerLightImpact();
    void handler();
  };
}
