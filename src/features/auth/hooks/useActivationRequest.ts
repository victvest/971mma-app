import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyActivationRequest,
  requestAccountActivation,
  type ActivationRequest,
} from '@/services/database/account.repository';

export const activationRequestKey = ['activation-request'] as const;

export function useActivationRequest(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: activationRequestKey,
    queryFn: getMyActivationRequest,
    enabled: options?.enabled ?? true,
  });
}

export function useSubmitActivationRequest() {
  const queryClient = useQueryClient();

  return useMutation<ActivationRequest, Error, void>({
    mutationFn: requestAccountActivation,
    onSuccess: (data) => {
      queryClient.setQueryData(activationRequestKey, data);
    },
  });
}
