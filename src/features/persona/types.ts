export type PersonaMessageRole = 'user' | 'assistant';

export type PersonaAction = {
  label: string;
  route: string;
};

export type PersonaMessage = {
  id: string;
  role: PersonaMessageRole;
  text: string;
  createdAt: number;
  actions?: PersonaAction[];
  isError?: boolean;
};

export type PersonaBubblePosition = {
  x: number;
  y: number;
};

export type PersonaChatHistoryEntry = {
  role: PersonaMessageRole;
  text: string;
};

export type PersonaChatResponse = {
  reply: string;
  actions: PersonaAction[];
};
