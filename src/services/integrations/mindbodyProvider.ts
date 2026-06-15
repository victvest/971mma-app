/**
 * Mindbody provider — STUB.
 *
 * Wiring plan (Mindbody Public API v6 — https://developers.mindbodyonline.com):
 *
 *  1. Auth: POST {baseUrl}/usertoken/issue with `Api-Key` + `SiteId` headers to
 *     obtain a staff/user AccessToken; send it as `Authorization` on calls.
 *  2. getMemberProfile(externalId): GET {baseUrl}/client/clients?clientIds={id}
 *     → map ClientId, FirstName/LastName, Photo, Email, membership/contracts.
 *  3. resolveMemberByQrToken(token): parse the 971 token (source must be
 *     'mindbody'); the memberId IS the Mindbody ClientId — return it directly,
 *     or look up via /client/clients?searchText= if a barcode/UniqueId is used.
 *  4. listMemberships(externalId): GET {baseUrl}/client/clientcontracts or
 *     /sale/... → map to Membership[].
 *  5. recordCheckIn: POST {baseUrl}/class/addclienttoclass (booking) and/or the
 *     arrival/check-in endpoint for the member at the gym.
 *
 * Credentials come from `mindbodyConfig` (src/config/integrations.ts), populated
 * via EXPO_PUBLIC_MINDBODY_* env vars. DO NOT hardcode real keys here.
 */
import { mindbodyConfig, isMindbodyConfigured } from '../../config/integrations';
import { parseMemberQrToken } from '../qrToken';
import type {
  CheckInResult,
  MemberProfile,
  MemberRef,
  Membership,
  ProfilePatch,
} from '../../types/models';
import type { IntegrationProvider, ProviderSource } from './types';

const NOT_CONFIGURED = 'Mindbody is not configured yet. Set EXPO_PUBLIC_MINDBODY_* env vars.';

export class MindbodyProvider implements IntegrationProvider {
  readonly source: ProviderSource = 'mindbody';

  // TODO: cache a usertoken obtained from {baseUrl}/usertoken/issue.
  private async ensureAuth(): Promise<void> {
    if (!isMindbodyConfigured()) throw new Error(NOT_CONFIGURED);
    // TODO: implement Mindbody usertoken issue + caching, using:
    //   headers: { 'Api-Key': mindbodyConfig.apiKey, SiteId: mindbodyConfig.siteId }
    void mindbodyConfig;
    throw new Error(NOT_CONFIGURED);
  }

  async getMemberProfile(_externalId?: string): Promise<MemberProfile | null> {
    await this.ensureAuth(); // throws until configured
    // TODO: GET /client/clients?clientIds=_externalId → map to MemberProfile.
    return null;
  }

  async updateMemberProfile(_patch: ProfilePatch): Promise<MemberProfile> {
    await this.ensureAuth();
    // TODO: POST /client/updateclient.
    throw new Error(NOT_CONFIGURED);
  }

  async resolveMemberByQrToken(token: string): Promise<MemberRef | null> {
    // Token parsing needs no network; only resolution does.
    const ref = parseMemberQrToken(token);
    if (!ref || ref.source !== 'mindbody') return null;
    // TODO: optionally verify the ClientId exists via /client/clients.
    return ref;
  }

  async listMemberships(_externalId?: string): Promise<Membership[]> {
    await this.ensureAuth();
    // TODO: GET /client/clientcontracts → map to Membership[].
    return [];
  }

  async recordCheckIn(_input: {
    memberId?: string;
    classId?: string | null;
    method?: string;
  }): Promise<CheckInResult> {
    await this.ensureAuth();
    // TODO: POST /class/addclienttoclass or the arrivals/check-in endpoint.
    throw new Error(NOT_CONFIGURED);
  }

  async listCheckIns(_input?: { limit?: number }): Promise<CheckInResult[]> {
    await this.ensureAuth();
    // TODO: GET client visit / attendance history from Mindbody.
    return [];
  }
}
