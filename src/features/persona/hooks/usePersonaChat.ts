import { useCallback, useMemo, useRef, useState } from 'react';
import type { ApiError } from '@/lib/apiError';
import { useActiveMemberId } from '@/hooks/useActiveMemberId';
import { useAuthStore } from '@/stores/useAuthStore';
import { useHomeDashboardSummary } from '@/features/home/hooks/useHomeDashboard';
import { PERSONA_ASSISTANT_NAME } from '../constants';
import { sendPersonaChatMessage } from '../services/personaChat.service';
import type { PersonaMessage } from '../types';

const WELCOME_MESSAGE: PersonaMessage = {
  id: 'welcome',
  role: 'assistant',
  text: `Hi — I'm your ${PERSONA_ASSISTANT_NAME}. Ask me about classes, coaches, belt progress, check-in, points, or rewards. I answer from your membership and academy data.`,
  createdAt: Date.now(),
};

const DEFAULT_SUGGESTIONS = [
  "What's on the schedule?",
  'How is my belt progress?',
  'How do I check in?',
  'Tell me about rewards',
] as const;

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatAssistantError(error: unknown): string {
  const apiError = error as ApiError;
  if (apiError?.rawCode === 'RATE_LIMITED') {
    return apiError.message;
  }
  if (apiError?.code === 'UNAUTHORIZED') {
    return 'Please sign in again to use the assistant.';
  }
  return 'Something went wrong. Please try again in a moment.';
}

export function usePersonaSuggestions(): readonly string[] {
  const dashboard = useHomeDashboardSummary();

  return useMemo(() => {
    const suggestions: string[] = [];
    const data = dashboard.data;

    if (data?.upcomingClasses?.length) {
      suggestions.push("What's my next class?");
    }
    if ((data?.disciplineScore?.currentStreak ?? 0) >= 2) {
      suggestions.push("How's my streak?");
    }
    if (data?.beltProgress) {
      suggestions.push('What do I need for my next stripe?');
    }
    if ((data?.points?.balance ?? 0) > 0) {
      suggestions.push('What can I redeem with my points?');
    }
    if (data?.coachPreview?.length) {
      suggestions.push('Who are my coaches?');
    }

    for (const fallback of DEFAULT_SUGGESTIONS) {
      if (suggestions.length >= 4) break;
      if (!suggestions.includes(fallback)) suggestions.push(fallback);
    }

    return suggestions.slice(0, 4);
  }, [dashboard.data]);
}

export function usePersonaChat() {
  const [messages, setMessages] = useState<PersonaMessage[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const inFlightRef = useRef(false);
  const activeMemberId = useActiveMemberId();
  const authUserId = useAuthStore((state) => state.user?.id ?? '');

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isTyping || inFlightRef.current) return;

      const userMessage: PersonaMessage = {
        id: createId('user'),
        role: 'user',
        text: trimmed,
        createdAt: Date.now(),
      };

      setMessages((current) => [...current, userMessage]);
      setIsTyping(true);
      inFlightRef.current = true;

      const history = [...messages, userMessage]
        .filter((entry) => entry.id !== 'welcome')
        .slice(-8)
        .map((entry) => ({
          role: entry.role,
          text: entry.text,
        }));

      try {
        const response = await sendPersonaChatMessage({
          message: trimmed,
          history,
          targetUserId:
            activeMemberId && authUserId && activeMemberId !== authUserId
              ? activeMemberId
              : undefined,
        });

        const assistantMessage: PersonaMessage = {
          id: createId('assistant'),
          role: 'assistant',
          text: response.reply,
          createdAt: Date.now(),
          actions: response.actions?.length ? response.actions : undefined,
        };
        setMessages((current) => [...current, assistantMessage]);
      } catch (error) {
        const assistantMessage: PersonaMessage = {
          id: createId('assistant'),
          role: 'assistant',
          text: formatAssistantError(error),
          createdAt: Date.now(),
          isError: true,
        };
        setMessages((current) => [...current, assistantMessage]);
      } finally {
        inFlightRef.current = false;
        setIsTyping(false);
      }
    },
    [activeMemberId, authUserId, isTyping, messages],
  );

  return {
    messages,
    isTyping,
    sendMessage,
  };
}

export { DEFAULT_SUGGESTIONS as PERSONA_SUGGESTIONS };
