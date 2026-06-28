import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { RollCallQueuedMark } from '@/features/coach/roll-call/utils/rollCallOfflineQueue';
import { memberRefKey } from '@/features/coach/roll-call/utils/rollCallOfflineQueue';

type RollCallOfflineQueueState = {
  queue: RollCallQueuedMark[];
  enqueue: (item: RollCallQueuedMark) => void;
  removeByClientId: (clientGeneratedId: string) => void;
  clearForClass: (classId: string) => void;
};

export const useRollCallOfflineQueueStore = create<RollCallOfflineQueueState>()(
  persist(
    (set) => ({
      queue: [],
      enqueue: (item) =>
        set((state) => {
          const memberKey = memberRefKey(item.mark);
          const withoutMember = state.queue.filter(
            (entry) =>
              !(
                entry.classId === item.classId &&
                memberRefKey(entry.mark) === memberKey
              ),
          );
          const withoutDupId = withoutMember.filter(
            (entry) => entry.clientGeneratedId !== item.clientGeneratedId,
          );
          return { queue: [...withoutDupId, item] };
        }),
      removeByClientId: (clientGeneratedId) =>
        set((state) => ({
          queue: state.queue.filter((entry) => entry.clientGeneratedId !== clientGeneratedId),
        })),
      clearForClass: (classId) =>
        set((state) => ({
          queue: state.queue.filter((entry) => entry.classId !== classId),
        })),
    }),
    {
      name: 'roll-call-offline-queue',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ queue: state.queue }),
    },
  ),
);
