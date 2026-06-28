import { create } from 'zustand';

type ActiveProfileState = {
  activeUserId: string | null;
  setActiveUserId: (userId: string | null) => void;
  reset: () => void;
};

export const useActiveProfileStore = create<ActiveProfileState>((set) => ({
  activeUserId: null,
  setActiveUserId: (userId) => set({ activeUserId: userId }),
  reset: () => set({ activeUserId: null }),
}));
