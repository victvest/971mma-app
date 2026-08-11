import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/jwt.ts';
import { cacheGet, cacheSet, mbPaginate } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

const STAFF_SYNC_TTL_SEC = 30 * 60;
const DEMO_STAFF_ID_PREFIXES = ['demo-', 'client-demo-'];

type StaffRequest = {
  force?: boolean;
};

type MbStaff = {
  Id?: unknown;
  Name?: unknown;
  FirstName?: unknown;
  LastName?: unknown;
  Bio?: unknown;
  ImageUrl?: unknown;
  Email?: unknown;
  Active?: unknown;
};

type StaffResponse = {
  StaffMembers?: MbStaff[];
};

type CoachRow = {
  id: string;
  slug: string | null;
  name: string;
  mindbody_staff_id: string | null;
};

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function asBoolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function staffName(staff: MbStaff): string | null {
  const directName = asString(staff.Name)?.trim();
  if (directName) return directName;

  const parts = [asString(staff.FirstName), asString(staff.LastName)]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' ') : null;
}

function slugFromName(name: string, mindbodyStaffId: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const safeBase = base || 'coach';
  const suffix = mindbodyStaffId.replace(/[^a-z0-9]/gi, '').slice(-6).toLowerCase();
  return `${safeBase}-${suffix}`;
}

function isDemoStaffId(staffId: string | null): boolean {
  return Boolean(
    staffId && DEMO_STAFF_ID_PREFIXES.some((prefix) => staffId.startsWith(prefix)),
  );
}

function mapStaffRow(staff: MbStaff, sortOrder: number, syncedAt: string): Record<string, unknown> | null {
  const mindbodyStaffId = asString(staff.Id);
  const name = staffName(staff);
  if (!mindbodyStaffId || !name) return null;
  if (!asBoolean(staff.Active, true)) return null;

  // Only pass Mindbody fields that have values. Omitting null photo/bio/specialty/rank
  // preserves curated academy data on upsert (PostgREST updates only provided columns).
  const bio = asString(staff.Bio)?.trim() || null;
  const photoUrl = asString(staff.ImageUrl)?.trim() || null;

  const row: Record<string, unknown> = {
    mindbody_staff_id: mindbodyStaffId,
    slug: slugFromName(name, mindbodyStaffId),
    name,
    staff_email: asString(staff.Email)?.trim().toLowerCase() || null,
    sort_order: sortOrder,
    active: true,
    deleted_at: null,
    last_synced_at: syncedAt,
  };

  if (bio) row.bio = bio;
  if (photoUrl) row.photo_url = photoUrl;

  return row;
}

/**
 * Mindbody staff → coaches directory.
 * Creates/updates rows keyed on mindbody_staff_id; soft-deactivates staff removed from Mindbody.
 */
Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: { code: 'BAD_REQUEST', message: 'POST required.' } },
      { status: 405 },
    );
  }

  try {
    await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as StaffRequest;
    const force = body.force === true;
    const svc = serviceClient();
    const cacheKey = 'staff:sync';

    if (!force) {
      const cached = await cacheGet<{ refreshed: boolean; count: number }>(svc, cacheKey);
      if (cached) {
        return jsonResponse({ refreshed: false, skipped: true, ...cached });
      }
    }

    const [staffMembers, coachesResult] = await Promise.all([
      mbPaginate<MbStaff, StaffResponse>(
        svc,
        '/staff/staff',
        {},
        (page) => page.StaffMembers ?? [],
      ),
      svc
        .from('coaches')
        .select('id, slug, name, mindbody_staff_id')
        .not('mindbody_staff_id', 'is', null),
    ]);

    if (coachesResult.error) {
      throw new MbError('UPSTREAM_ERROR', 'Unable to read coach directory.');
    }

    const existingCoaches = (coachesResult.data ?? []) as CoachRow[];
    const syncedAt = new Date().toISOString();
    const rows: Record<string, unknown>[] = [];
    const seenStaffIds = new Set<string>();

    staffMembers.forEach((staff, index) => {
      const row = mapStaffRow(staff, (index + 1) * 10, syncedAt);
      if (!row) return;
      seenStaffIds.add(String(row.mindbody_staff_id));
      rows.push(row);
    });

    let created = 0;
    let updated = 0;

    if (rows.length > 0) {
      const { data: upserted, error: upsertError } = await svc
        .from('coaches')
        .upsert(rows, { onConflict: 'mindbody_staff_id' })
        .select('id, mindbody_staff_id');

      if (upsertError) {
        throw new MbError('UPSTREAM_ERROR', `Unable to upsert coaches: ${upsertError.message}`);
      }

      const existingIds = new Set(
        existingCoaches.map((coach) => coach.mindbody_staff_id).filter(Boolean),
      );

      for (const row of upserted ?? []) {
        const staffId = asString(row.mindbody_staff_id);
        if (!staffId) continue;
        if (existingIds.has(staffId)) updated += 1;
        else created += 1;
      }
    }

    const staleIds = existingCoaches
      .filter(
        (coach) =>
          coach.mindbody_staff_id &&
          !isDemoStaffId(coach.mindbody_staff_id) &&
          !seenStaffIds.has(coach.mindbody_staff_id),
      )
      .map((coach) => coach.id);

    let deactivated = 0;
    if (staleIds.length > 0) {
      const { error: deactivateError } = await svc
        .from('coaches')
        .update({ active: false, deleted_at: syncedAt, last_synced_at: syncedAt })
        .in('id', staleIds);

      if (deactivateError) {
        throw new MbError(
          'UPSTREAM_ERROR',
          `Unable to deactivate stale coaches: ${deactivateError.message}`,
        );
      }
      deactivated = staleIds.length;
    }

    const payload = {
      refreshed: true,
      source: 'mindbody',
      mindbodyStaffCount: staffMembers.length,
      activeStaffSynced: rows.length,
      created,
      updated,
      deactivated,
      coaches: rows.slice(0, 20).map((row) => ({
        mindbodyStaffId: row.mindbody_staff_id,
        name: row.name,
        slug: row.slug,
      })),
    };

    await cacheSet(svc, cacheKey, { refreshed: true, count: rows.length }, STAFF_SYNC_TTL_SEC);

    const { data: suggestionsUpdated } = await svc.rpc('refresh_coach_user_suggestions');

    return jsonResponse({ ...payload, suggestionsUpdated: suggestionsUpdated ?? 0 });
  } catch (error) {
    return toErrorResponse(error);
  }
});
