import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/jwt.ts';
import { mbPaginate } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

type ParityRequest = {
  startDate?: string;
  endDate?: string;
};

type MbStaff = {
  Id?: unknown;
  Name?: unknown;
  FirstName?: unknown;
  LastName?: unknown;
  Bio?: unknown;
  ImageUrl?: unknown;
};

type MbClassDescription = {
  Name?: unknown;
  Program?: { Id?: unknown; Name?: unknown };
  SessionType?: { Id?: unknown; Name?: unknown };
};

type MbClass = {
  Id?: unknown;
  StartDateTime?: unknown;
  EndDateTime?: unknown;
  MaxCapacity?: unknown;
  TotalBooked?: unknown;
  IsAvailable?: unknown;
  IsWaitlistAvailable?: unknown;
  IsCanceled?: unknown;
  ClassDescription?: MbClassDescription;
  Staff?: MbStaff;
};

type ClassesResponse = { Classes?: MbClass[] };
type StaffResponse = { StaffMembers?: MbStaff[] };

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
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

function disciplineOf(classDescription: MbClassDescription | undefined): string {
  return (
    asString(classDescription?.SessionType?.Name) ??
    asString(classDescription?.Program?.Name) ??
    'General'
  );
}

function parseRange(body: ParityRequest): { startDate: string; endDate: string } {
  const startDate = body.startDate?.trim();
  const endDate = body.endDate?.trim();
  if (!startDate || !endDate) {
    throw new MbError('BAD_REQUEST', 'startDate and endDate are required.');
  }
  return { startDate, endDate };
}

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
    const body = (await req.json().catch(() => ({}))) as ParityRequest;
    const { startDate, endDate } = parseRange(body);
    const siteId = Deno.env.get('MINDBODY_SITE_ID') ?? null;
    const svc = serviceClient();

    const [classes, staffMembers] = await Promise.all([
      mbPaginate<MbClass, ClassesResponse>(
        svc,
        '/class/classes',
        {
          'request.startDateTime': startDate,
          'request.endDateTime': endDate,
          'request.hideCanceledClasses': 'false',
        },
        (page) => page.Classes ?? [],
      ),
      mbPaginate<MbStaff, StaffResponse>(
        svc,
        '/staff/staff',
        {},
        (page) => page.StaffMembers ?? [],
      ),
    ]);

    const normalizedClasses = classes
      .map((mbClass) => {
        const mindbodyClassId = asString(mbClass.Id);
        const startsAt = asString(mbClass.StartDateTime);
        const title = asString(mbClass.ClassDescription?.Name);
        if (!mindbodyClassId || !startsAt || !title) return null;

        return {
          mindbodyClassId,
          title,
          discipline: disciplineOf(mbClass.ClassDescription),
          coachName: asString(mbClass.Staff?.Name) ?? staffName(mbClass.Staff ?? {}) ?? 'Coach',
          startsAt,
          capacity: asNumber(mbClass.MaxCapacity, 0),
          bookedCount: asNumber(mbClass.TotalBooked, 0),
          isAvailable: asBoolean(mbClass.IsAvailable, false),
          isWaitlistAvailable: asBoolean(mbClass.IsWaitlistAvailable, false),
          isCancelled: asBoolean(mbClass.IsCanceled, false),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .filter((row) => !row.isCancelled);

    const normalizedCoaches = staffMembers
      .map((staff) => {
        const mindbodyStaffId = asString(staff.Id);
        const name = staffName(staff);
        if (!mindbodyStaffId || !name) return null;

        return {
          mindbodyStaffId,
          name,
          bio: asString(staff.Bio),
          photoUrl: asString(staff.ImageUrl),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    return jsonResponse({
      siteId,
      range: { startDate, endDate },
      classes: normalizedClasses,
      coaches: normalizedCoaches,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
});
