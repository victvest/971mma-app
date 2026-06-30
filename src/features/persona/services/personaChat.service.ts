import { invokeEdge } from '@/services/mindbody/edgeClient';
import type { PersonaChatHistoryEntry, PersonaChatResponse } from '../types';

type PersonaChatRequest = {
  message: string;
  history: PersonaChatHistoryEntry[];
  targetUserId?: string;
};

export async function sendPersonaChatMessage(payload: PersonaChatRequest): Promise<PersonaChatResponse> {
  return invokeEdge<PersonaChatResponse, PersonaChatRequest>('persona-chat', payload);
}
