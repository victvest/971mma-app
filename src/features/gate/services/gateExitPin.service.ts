import { getSupabaseClient } from '@/services/supabase/client';

export type GateExitPinStatus = {
  exitPinConfigured: boolean;
  updatedAt: string | null;
};

function mapStatus(row: {
  exitPinConfigured?: boolean;
  exit_pin_configured?: boolean;
  updatedAt?: string | null;
  updated_at?: string | null;
} | null): GateExitPinStatus {
  return {
    exitPinConfigured: Boolean(row?.exitPinConfigured ?? row?.exit_pin_configured),
    updatedAt: row?.updatedAt ?? row?.updated_at ?? null,
  };
}

export async function fetchGateExitPinStatus(): Promise<GateExitPinStatus> {
  const { data, error } = await getSupabaseClient().rpc('gate_exit_pin_status');
  if (error) throw error;
  return mapStatus(data as Record<string, unknown> | null);
}

export async function validateGateExitPinRemote(pin: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('gate_validate_exit_pin', {
    p_pin: pin,
  });
  if (error) throw error;
  return Boolean(data);
}
