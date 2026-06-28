import { getSupabaseClient } from '@/services/supabase/client';

type ToggleClassSubscriptionResult = {
  subscribed?: unknown;
};

function readSubscribed(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (value && typeof value === 'object' && 'subscribed' in value) {
    return Boolean((value as ToggleClassSubscriptionResult).subscribed);
  }
  return false;
}

export async function isClassSubscribed(classId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('is_class_subscribed', {
    p_class_id: classId,
  });

  if (error) throw error;
  return data === true;
}

export async function toggleClassSubscription(classId: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient().rpc('toggle_class_subscription', {
    p_class_id: classId,
  });

  if (error) throw error;
  return readSubscribed(data);
}
