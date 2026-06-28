import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { MbError, toErrorResponse } from '../_shared/errors.ts';
import { requireUser } from '../_shared/jwt.ts';
import { mbPaginate } from '../_shared/mindbody.ts';
import { serviceClient } from '../_shared/supabase.ts';

const PROGRAMS_TTL_MS = 24 * 60 * 60 * 1000;

type Program = {
  Id?: unknown;
  Name?: unknown;
  ScheduleType?: unknown;
};

type SessionType = {
  Id?: unknown;
  Name?: unknown;
  ProgramId?: unknown;
};

type ProgramsResponse = {
  Programs?: Program[];
};

type SessionTypesResponse = {
  SessionTypes?: SessionType[];
};

function asString(value: unknown): string | null {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
}

function programsAreFresh(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) return false;
  return Date.now() - new Date(lastSyncedAt).getTime() < PROGRAMS_TTL_MS;
}

function detectDisciplineSlug(programName: string, sessionTypeName?: string): string {
  const text = `${programName} ${sessionTypeName ?? ''}`.toLowerCase();
  if (text.includes('jiu') || text.includes('bjj')) return 'bjj';
  if (text.includes('wrest')) return 'wrestling';
  if (text.includes('muay') || text.includes('thai') || text.includes('strik')) return 'muay_thai';
  if (text.includes('mma') || text.includes('mixed')) return 'mma';
  if (text.includes('box')) return 'boxing';
  if (text.includes('personal') || text.includes('pt')) return 'personal_training';
  if (text.includes('yoga') || text.includes('mobil') || text.includes('stretch')) return 'yoga_mobility';
  return 'performance_fitness'; // Default fallback
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
    const svc = serviceClient();

    // 1. Fetch disciplines reference
    const { data: disciplines, error: disciplinesError } = await svc
      .from('disciplines')
      .select('id, slug');
    if (disciplinesError) throw new MbError('UPSTREAM_ERROR', 'Unable to read disciplines reference.');

    // 2. Fetch existing programs to preserve manual admin mappings
    const { data: existingPrograms, error: existingError } = await svc
      .from('programs')
      .select('mindbody_program_id, discipline_id, last_synced_at')
      .eq('active', true);

    if (existingError) throw new MbError('UPSTREAM_ERROR', 'Unable to read programs mirror.');

    const syncedAt =
      existingPrograms && existingPrograms.length > 0
        ? existingPrograms.reduce<string | null>((latest, row) => {
            const value = row.last_synced_at as string | null;
            if (!value) return latest;
            if (!latest || value > latest) return value;
            return latest;
          }, null)
        : null;

    if (programsAreFresh(syncedAt)) {
      return jsonResponse({ refreshed: false, count: existingPrograms?.length ?? 0 });
    }

    const existingMap = new Map<string, string>();
    if (existingPrograms) {
      for (const p of existingPrograms) {
        if (p.discipline_id) {
          existingMap.set(p.mindbody_program_id, p.discipline_id);
        }
      }
    }

    const [programs, sessionTypes] = await Promise.all([
      mbPaginate<Program, ProgramsResponse>(
        svc,
        '/site/programs',
        {},
        (page) => page.Programs ?? [],
      ),
      mbPaginate<SessionType, SessionTypesResponse>(
        svc,
        '/site/sessiontypes',
        {},
        (page) => page.SessionTypes ?? [],
      ),
    ]);

    const sessionTypesByProgram = new Map<string, number[]>();
    for (const sessionType of sessionTypes) {
      const programId = asString(sessionType.ProgramId);
      const sessionTypeId = asString(sessionType.Id);
      if (!programId || !sessionTypeId) continue;
      const bucket = sessionTypesByProgram.get(programId) ?? [];
      bucket.push(Number(sessionTypeId));
      sessionTypesByProgram.set(programId, bucket);
    }

    const now = new Date().toISOString();
    const rows = programs
      .map((program) => {
        const mindbodyProgramId = asString(program.Id);
        const name = asString(program.Name);
        if (!mindbodyProgramId || !name) return null;

        const relatedSessionTypes = sessionTypes.filter(
          (sessionType) => asString(sessionType.ProgramId) === mindbodyProgramId,
        );

        // Preserve admin-selected discipline_id, otherwise auto-detect
        let disciplineId = existingMap.get(mindbodyProgramId) || null;
        if (!disciplineId) {
          const sessionTypeName = relatedSessionTypes[0]?.Name ? String(relatedSessionTypes[0].Name) : undefined;
          const slug = detectDisciplineSlug(name, sessionTypeName);
          const matched = disciplines?.find((d) => d.slug === slug);
          if (matched) {
            disciplineId = matched.id;
          }
        }

        return {
          mindbody_program_id: mindbodyProgramId,
          name,
          discipline_id: disciplineId,
          session_type_ids: sessionTypesByProgram.get(mindbodyProgramId) ?? [],
          active: true,
          last_synced_at: now,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length > 0) {
      const { error: upsertError } = await svc
        .from('programs')
        .upsert(rows, { onConflict: 'mindbody_program_id' });
      if (upsertError) throw new MbError('UPSTREAM_ERROR', 'Unable to upsert programs mirror.');
    }

    return jsonResponse({ refreshed: true, count: rows.length });
  } catch (error) {
    return toErrorResponse(error);
  }
});
