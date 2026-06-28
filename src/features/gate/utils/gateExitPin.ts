import {
  fetchGateExitPinStatus,
  validateGateExitPinRemote,
} from '@/features/gate/services/gateExitPin.service';

export type { GateExitPinStatus } from '@/features/gate/services/gateExitPin.service';

export async function gateExitPinRequiresSetup(): Promise<boolean> {
  const status = await fetchGateExitPinStatus();
  return !status.exitPinConfigured;
}

export async function validateGateExitPin(input: string): Promise<boolean> {
  const trimmed = input.trim();
  if (!/^\d{4}$/.test(trimmed)) return false;
  return validateGateExitPinRemote(trimmed);
}

export async function fetchGateExitPinUpdatedAt(): Promise<string | null> {
  const status = await fetchGateExitPinStatus();
  return status.updatedAt;
}
