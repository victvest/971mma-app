export type PersonaMessageRole = 'user' | 'assistant';

export type PersonaMessage = {
  id: string;
  role: PersonaMessageRole;
  text: string;
  createdAt: number;
};

export type PersonaBubblePosition = {
  x: number;
  y: number;
};
