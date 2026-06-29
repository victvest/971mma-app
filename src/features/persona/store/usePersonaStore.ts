import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import type { PersonaBubblePosition } from '../types';

const BUBBLE_POSITION_KEY = 'persona:bubble-position';

type PersonaState = {
  isChatOpen: boolean;
  bubblePosition: PersonaBubblePosition | null;
  openChat: () => void;
  closeChat: () => void;
  setBubblePosition: (position: PersonaBubblePosition) => void;
  hydrateBubblePosition: () => Promise<void>;
};

export const usePersonaStore = create<PersonaState>((set) => ({
  isChatOpen: false,
  bubblePosition: null,
  openChat: () => set({ isChatOpen: true }),
  closeChat: () => set({ isChatOpen: false }),
  setBubblePosition: (position) => {
    set({ bubblePosition: position });
    void AsyncStorage.setItem(BUBBLE_POSITION_KEY, JSON.stringify(position));
  },
  hydrateBubblePosition: async () => {
    try {
      const raw = await AsyncStorage.getItem(BUBBLE_POSITION_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as PersonaBubblePosition;
      if (
        typeof parsed?.x === 'number' &&
        Number.isFinite(parsed.x) &&
        typeof parsed?.y === 'number' &&
        Number.isFinite(parsed.y)
      ) {
        set({ bubblePosition: parsed });
      }
    } catch {
      // Ignore corrupt persisted state.
    }
  },
}));
