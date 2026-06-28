import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  isClassSubscribed,
  toggleClassSubscription,
} from '@/services/database/classSubscriptions.repository';
import { useAuthStore } from '@/stores/useAuthStore';

export const classSubscriptionKey = (userId: string, classId: string) =>
  ['class-subscription', userId, classId] as const;

export function useClassSubscription(classId: string | undefined) {
  const userId = useAuthStore((state) => state.user?.id ?? '');

  return useQuery({
    queryKey: classSubscriptionKey(userId, classId ?? ''),
    queryFn: () => {
      if (!classId) throw new Error('Class id is required.');
      return isClassSubscribed(classId);
    },
    enabled: Boolean(userId && classId),
    staleTime: 30 * 1000,
  });
}

export function useToggleClassSubscription() {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (classId: string) => toggleClassSubscription(classId),
    onMutate: async (classId) => {
      const queryKey = classSubscriptionKey(userId, classId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<boolean>(queryKey);
      queryClient.setQueryData<boolean>(queryKey, !(previous ?? false));
      return { classId, previous };
    },
    onError: (_error, _classId, context) => {
      if (!context) return;
      queryClient.setQueryData(
        classSubscriptionKey(userId, context.classId),
        context.previous,
      );
    },
    onSuccess: (subscribed, classId) => {
      queryClient.setQueryData(classSubscriptionKey(userId, classId), subscribed);
    },
    onSettled: (_data, _error, classId) => {
      void queryClient.invalidateQueries({
        queryKey: classSubscriptionKey(userId, classId),
      });
    },
  });
}
