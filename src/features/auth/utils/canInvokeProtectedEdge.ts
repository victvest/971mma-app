import { useAuthStore } from '@/stores/useAuthStore';

/** Supabase edge functions with verify_jwt require a signed-in member session. */
export function canInvokeProtectedEdge(): boolean {
  const { role, user } = useAuthStore.getState();
  return role !== 'guest' && Boolean(user?.id);
}

export function useCanInvokeProtectedEdge(): boolean {
  const role = useAuthStore((state) => state.role);
  const userId = useAuthStore((state) => state.user?.id);
  return role !== 'guest' && Boolean(userId);
}
