/** Mindbody visit payload helpers — kept free of classify imports to avoid cycles. */

function readNestedString(payload: Record<string, unknown>, keys: string[]): string | null {
  let current: unknown = payload;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' && current.trim() ? current.trim() : null;
}

function readNestedId(payload: Record<string, unknown>, keys: string[]): string | null {
  let current: unknown = payload;
  for (const key of keys) {
    if (!current || typeof current !== 'object') return null;
    current = (current as Record<string, unknown>)[key];
  }
  if (typeof current === 'number' && Number.isFinite(current)) return String(current);
  if (typeof current === 'string' && current.trim()) return current.trim();
  return null;
}

/** Mindbody visit class title when check_ins.class_id is null (unmapped schedule row). */
export function extractMindbodyVisitClassTitle(
  rawPayload: Record<string, unknown> | null | undefined,
): string | null {
  if (!rawPayload) return null;

  return (
    readNestedString(rawPayload, ['ClassDescription', 'Name']) ??
    readNestedString(rawPayload, ['Class', 'ClassDescription', 'Name']) ??
    readNestedString(rawPayload, ['Class', 'Name']) ??
    readNestedString(rawPayload, ['Name']) ??
    null
  );
}

/** True when Mindbody payload references a class (even without a resolvable title). */
export function extractMindbodyVisitClassId(
  rawPayload: Record<string, unknown> | null | undefined,
): string | null {
  if (!rawPayload) return null;
  return (
    readNestedId(rawPayload, ['ClassId']) ??
    readNestedId(rawPayload, ['Class', 'Id']) ??
    readNestedId(rawPayload, ['Class', 'ClassId']) ??
    null
  );
}
