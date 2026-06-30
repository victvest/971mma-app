import type { serviceClient } from './supabase.ts';

type DisciplineRow = { id: string; slug: string };

type MembershipMirrorRow = {
  record_kind: 'membership' | 'contract';
  mindbody_record_id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

export type ProductDisciplineMapping = {
  match_type: 'mindbody_id' | 'name_exact' | 'name_contains';
  match_value: string;
  discipline_id: string;
  priority: number;
};

/** Same heuristics as mb-programs — maps product/plan names to discipline slugs. */
export function detectDisciplineSlugFromProductName(name: string): string {
  const text = name.toLowerCase();
  if (text.includes('jiu') || text.includes('bjj')) return 'bjj';
  if (text.includes('wrest')) return 'wrestling';
  if (text.includes('muay') || text.includes('thai') || text.includes('strik')) return 'muay_thai';
  if (text.includes('mma') || text.includes('mixed')) return 'mma';
  if (text.includes('box')) return 'boxing';
  if (text.includes('personal') || text.includes('pt')) return 'personal_training';
  if (text.includes('yoga') || text.includes('mobil') || text.includes('stretch')) return 'yoga_mobility';
  return 'performance_fitness';
}

function toDateOnly(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

function mappingMatches(row: MembershipMirrorRow, mapping: ProductDisciplineMapping): boolean {
  const nameLower = row.name.toLowerCase();
  const valueLower = mapping.match_value.toLowerCase().trim();

  switch (mapping.match_type) {
    case 'mindbody_id':
      return row.mindbody_record_id.trim() === mapping.match_value.trim();
    case 'name_exact':
      return nameLower === valueLower;
    case 'name_contains':
      return valueLower.length > 0 && nameLower.includes(valueLower);
    default:
      return false;
  }
}

/** Resolve discipline IDs from admin mappings (priority wins), then name heuristics. */
export function resolveDisciplineIdsForProduct(
  row: MembershipMirrorRow,
  mappings: ProductDisciplineMapping[],
  slugToId: Map<string, string>,
): string[] {
  if (mappings.length === 0) {
    const slug = detectDisciplineSlugFromProductName(row.name);
    const id = slugToId.get(slug);
    return id ? [id] : [];
  }

  let bestPriority: number | null = null;
  const disciplineIds = new Set<string>();

  for (const mapping of mappings) {
    if (!mappingMatches(row, mapping)) continue;

    if (bestPriority === null || mapping.priority < bestPriority) {
      bestPriority = mapping.priority;
      disciplineIds.clear();
      disciplineIds.add(mapping.discipline_id);
    } else if (mapping.priority === bestPriority) {
      disciplineIds.add(mapping.discipline_id);
    }
  }

  if (disciplineIds.size > 0) {
    return [...disciplineIds];
  }

  const slug = detectDisciplineSlugFromProductName(row.name);
  const id = slugToId.get(slug);
  return id ? [id] : [];
}

async function loadProductDisciplineMappings(
  svc: ReturnType<typeof serviceClient>,
): Promise<ProductDisciplineMapping[]> {
  const { data, error } = await svc
    .from('membership_product_disciplines')
    .select('match_type, match_value, discipline_id, priority')
    .eq('active', true)
    .order('priority', { ascending: true });

  if (error || !data?.length) return [];
  return data as ProductDisciplineMapping[];
}

/**
 * Derive member_disciplines rows from mirrored Mindbody membership/contract names.
 * Preserves admin_override rows. Uses membership_product_disciplines when configured.
 */
export async function syncMemberDisciplinesFromMembershipMirror(
  svc: ReturnType<typeof serviceClient>,
  userId: string,
  rows: MembershipMirrorRow[],
): Promise<number> {
  const { data: disciplines, error: disciplinesError } = await svc
    .from('disciplines')
    .select('id, slug')
    .eq('active', true);

  if (disciplinesError || !disciplines?.length) return 0;

  const slugToId = new Map(
    (disciplines as DisciplineRow[]).map((row) => [row.slug, row.id]),
  );

  const mappings = await loadProductDisciplineMappings(svc);

  await svc
    .from('member_disciplines')
    .delete()
    .eq('user_id', userId)
    .in('source', ['mindbody_membership', 'mindbody_contract']);

  const payload: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    if (row.status !== 'active' && row.status !== 'paused') continue;

    const disciplineIds = resolveDisciplineIdsForProduct(row, mappings, slugToId);
    if (disciplineIds.length === 0) continue;

    const source = row.record_kind === 'contract' ? 'mindbody_contract' : 'mindbody_membership';

    for (const disciplineId of disciplineIds) {
      payload.push({
        user_id: userId,
        discipline_id: disciplineId,
        source,
        mindbody_membership_id: row.mindbody_record_id,
        active: row.status === 'active',
        starts_on: toDateOnly(row.start_date),
        ends_on: toDateOnly(row.end_date),
        updated_at: new Date().toISOString(),
      });
    }
  }

  if (payload.length === 0) return 0;

  const { error: upsertError } = await svc.from('member_disciplines').upsert(payload, {
    onConflict: 'user_id,discipline_id,source,mindbody_membership_id',
  });

  if (upsertError) {
    throw upsertError;
  }

  return payload.length;
}
