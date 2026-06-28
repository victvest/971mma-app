import { useMutation } from '@tanstack/react-query';
import {
  submitSupportMessage,
  type SubmitSupportMessageInput,
  type SupportMessage,
} from '@/features/support/services/supportMessages';

export function useSubmitSupportMessage() {
  return useMutation<SupportMessage, Error, SubmitSupportMessageInput>({
    mutationFn: submitSupportMessage,
  });
}
