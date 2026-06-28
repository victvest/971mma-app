import { MbError } from './errors.ts';
import { userClient } from './supabase.ts';

export type UserRole = 'member' | 'coach' | 'admin' | 'gate';

export type AuthUser = {
  userId: string;
  email: string;
  role: UserRole;
};

function normalizeRole(value: unknown): UserRole {
  if (value === 'coach' || value === 'admin' || value === 'gate') return value;
  return 'member';
}

export async function requireUser(req: Request): Promise<AuthUser> {
  const client = userClient(req);
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new MbError('UNAUTHORIZED', 'Sign in is required.');
  }

  const userId = data.user.id;
  const { data: profile } = await client
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  return {
    userId,
    email: data.user.email ?? '',
    role: normalizeRole(profile?.role),
  };
}

export function requireRole(user: AuthUser, roles: UserRole[]): void {
  if (!roles.includes(user.role)) {
    throw new MbError('FORBIDDEN', 'You do not have permission to perform this action.');
  }
}
