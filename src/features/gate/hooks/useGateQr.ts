import { useQuery } from '@tanstack/react-query';
import { invokeEdge } from '@/services/mindbody/edgeClient';
import { SECURE_QUERY_OPTIONS } from '@/lib/queryCachePolicy';
import type { GateQrResponse } from '@/features/gate/types';

export const gateQrKey = ['gate-qr'] as const;

const REFRESH_MS = 20_000;

export function useGateQr(focused = true) {
  return useQuery({
    queryKey: gateQrKey,
    queryFn: () => invokeEdge<GateQrResponse>('gate-qr-issue'),
    enabled: focused,
    ...SECURE_QUERY_OPTIONS,
    refetchInterval: focused ? REFRESH_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: focused,
  });
}

export const GATE_QR_REFRESH_SECONDS = 20;
