import { useCallback, useRef, useState } from 'react';
import { PERSONA_ASSISTANT_NAME } from '../constants';
import type { PersonaMessage } from '../types';

const WELCOME_MESSAGE: PersonaMessage = {
  id: 'welcome',
  role: 'assistant',
  text: `Hi — I'm your ${PERSONA_ASSISTANT_NAME}. Ask me about classes, belt progress, check-in, rewards, or anything academy-related. I'll answer from your membership context soon.`,
  createdAt: Date.now(),
};

const PLACEHOLDER_REPLIES = [
  "Thanks for your question. I'm still learning the academy database — for now this is a preview of the chat experience.",
  "I'll connect to your schedule, attendance, and belt data in a future update. What would you like to know first?",
  "Great question. Once live, I'll pull answers from your profile and academy knowledge base.",
] as const;

export const PERSONA_SUGGESTIONS = [
  "What's on the schedule today?",
  'How does belt progression work?',
  'How do I check in?',
  'Tell me about rewards',
] as const;

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function usePersonaChat() {
  const [messages, setMessages] = useState<PersonaMessage[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const replyIndexRef = useRef(0);

  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMessage: PersonaMessage = {
      id: createId('user'),
      role: 'user',
      text: trimmed,
      createdAt: Date.now(),
    };

    setMessages((current) => [...current, userMessage]);
    setIsTyping(true);

    const reply =
      PLACEHOLDER_REPLIES[replyIndexRef.current % PLACEHOLDER_REPLIES.length] ??
      PLACEHOLDER_REPLIES[0];
    replyIndexRef.current += 1;

    setTimeout(() => {
      const assistantMessage: PersonaMessage = {
        id: createId('assistant'),
        role: 'assistant',
        text: reply,
        createdAt: Date.now(),
      };
      setMessages((current) => [...current, assistantMessage]);
      setIsTyping(false);
    }, 900);
  }, [isTyping]);

  return {
    messages,
    isTyping,
    sendMessage,
  };
}
