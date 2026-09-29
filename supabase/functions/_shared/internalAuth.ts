import { MbError } from './errors.ts';

function timingSafeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return diff === 0;
}

export function requireInternalSecret(req: Request): void {
  const expectedSecrets = [Deno.env.get('CRON_SECRET'), Deno.env.get('NOTIFICATION_PUSH_SECRET')]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  if (expectedSecrets.length === 0) {
    throw new MbError('UPSTREAM_ERROR', 'Missing server internal secret.', 500);
  }

  const headerSecret = req.headers.get('x-cron-secret')?.trim();
  const authorization = req.headers.get('authorization')?.trim() ?? '';
  const bearerSecret = authorization.toLowerCase().startsWith('bearer ')
    ? authorization.slice(7).trim()
    : null;
  const provided = headerSecret ?? bearerSecret;

  if (!provided || !expectedSecrets.some((expected) => timingSafeEqual(provided, expected))) {
    throw new MbError('UNAUTHORIZED', 'Invalid internal secret.');
  }
}
