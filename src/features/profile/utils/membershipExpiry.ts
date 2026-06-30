/** Pick the furthest future Mindbody end date from membership mirror rows. */
export function pickLatestMembershipEndDate(
  candidates: Array<string | null | undefined>,
): string | null {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate) continue;
    const time = new Date(candidate).getTime();
    if (Number.isNaN(time)) continue;
    if (time > latestTime) {
      latest = candidate;
      latestTime = time;
    }
  }

  return latest;
}
