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

export function requireSaltoBearerToken(req: Request): void {
  const expected = Deno.env.get('SALTO_API_BEARER_TOKEN');
  if (!expected) {
    throw new MbError('UPSTREAM_ERROR', 'Missing server env: SALTO_API_BEARER_TOKEN', 500);
  }

  const authorization = req.headers.get('authorization')?.trim() ?? '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw new MbError('UNAUTHORIZED', 'Missing bearer token.');
  }

  const provided = authorization.slice(7).trim();
  if (!provided || !timingSafeEqual(provided, expected)) {
    throw new MbError('UNAUTHORIZED', 'Invalid bearer token.');
  }
}
