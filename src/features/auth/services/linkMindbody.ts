import { invokeEdge } from '@/services/mindbody/edgeClient';

export type MindbodyLinkResult = {
  clientId: string;
  uniqueId: string | null;
  linkMethod: 'matched_email' | 'matched_phone' | 'created' | 'manual';
};

export async function ensureMindbodyLink(): Promise<MindbodyLinkResult> {
  return invokeEdge<MindbodyLinkResult>('mb-link');
}
