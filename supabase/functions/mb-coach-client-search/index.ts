import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireRole, requireUser } from '../_shared/jwt.ts';
import { mbFetch } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type SearchRequest = {
  query?: string;
  classId?: string;
  limit?: number;
};

type MbClient = {
  Id?: unknown;
  FirstName?: unknown;
  LastName?: unknown;
  Email?: unknown;
};

type ClientSearchResponse = {
  Clients?: MbClient[];
};

type LinkRow = {
  user_id: string;
  mindbody_client_id: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  belt_rank: string | null;
  belt_stripes: number | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function clientIdOf(client: MbClient): string | null {
  return asString(client.Id);
}

function clientName(client: MbClient): string {
  const first = asString(client.FirstName)?.trim() ?? '';
  const last = asString(client.LastName)?.trim() ?? '';
  const full = `${first} ${last}`.trim();
  return full || 'Member';
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse({ error: { code: 'BAD_REQUEST', message: 'POST required.' } }, { status: 405 });
  }

  try {
    const caller = await requireUser(req);
    requireRole(caller, ['coach', 'admin']);

    const body = (await req.json().catch(() => ({}))) as SearchRequest;
    const query = body.query?.trim();
    const classId = body.classId?.trim() || null;
    const limit = Math.max(1, Math.min(body.limit ?? 20, 30));

    if (!query) {
      return jsonResponse({ results: [] });
    }

    const params = new URLSearchParams();
    params.set('request.limit', String(limit));
    params.set('request.offset', '0');
    params.set('request.searchText', query);
    params.set('request.includeInactive', 'false');

    const svc = serviceClient();
    const response = await mbFetch<ClientSearchResponse>(
      svc,
      `/client/clients?${params.toString()}`,
    );

    const rawClients = response.Clients ?? [];
    const clientIds = rawClients
      .map((client) => clientIdOf(client))
      .filter((value): value is string => Boolean(value));

    const linkMap = new Map<string, string>();
    const profileMap = new Map<string, ProfileRow>();

    if (clientIds.length > 0) {
      const { data: links, error: linkError } = await svc
        .from('mindbody_links')
        .select('user_id, mindbody_client_id')
        .in('mindbody_client_id', clientIds);

      if (linkError) throw new MbError('UPSTREAM_ERROR', 'Unable to read Mindbody links.');

      for (const link of (links ?? []) as LinkRow[]) {
        linkMap.set(link.mindbody_client_id, link.user_id);
      }

      const userIds = [...new Set(linkMap.values())];
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await svc
          .from('profiles')
          .select('id, full_name, avatar_url, belt_rank, belt_stripes')
          .in('id', userIds);

        if (profileError) throw new MbError('UPSTREAM_ERROR', 'Unable to read member profiles.');

        for (const profile of (profiles ?? []) as ProfileRow[]) {
          profileMap.set(profile.id, profile);
        }
      }
    }

    const deckKeysOnClass = new Set<string>();
    if (classId) {
      const { data: attendance } = await svc
        .from('class_session_attendance')
        .select('user_id, mindbody_client_id')
        .eq('class_id', classId);

      for (const row of attendance ?? []) {
        if (row.user_id) deckKeysOnClass.add(String(row.user_id));
        if (row.mindbody_client_id) deckKeysOnClass.add(`mb:${row.mindbody_client_id}`);
      }
    }

    const results = rawClients
      .map((client) => {
        const mindbodyClientId = clientIdOf(client);
        if (!mindbodyClientId) return null;

        const userId = linkMap.get(mindbodyClientId) ?? null;
        const profile = userId ? profileMap.get(userId) ?? null : null;
        const deckKey = userId ?? `mb:${mindbodyClientId}`;

        return {
          deckKey,
          displayName: profile?.full_name?.trim() || clientName(client),
          avatarUrl: profile?.avatar_url ?? null,
          beltRank: profile?.belt_rank ?? null,
          beltStripes: profile?.belt_stripes ?? 0,
          userId,
          mindbodyClientId,
          isOnApp: Boolean(userId),
          alreadyOnDeck: deckKeysOnClass.has(deckKey),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return jsonResponse({ results });
  } catch (error) {
    return toErrorResponse(error);
  }
});
