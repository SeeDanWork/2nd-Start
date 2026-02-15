import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface OfflineWriteItem {
  id: string;
  type: 'create_request' | 'accept_proposal';
  payload: Record<string, unknown>;
  createdAt: string;
}

interface CacheState {
  // Cached data
  activeSchedule: any | null;
  assignments: any[];
  familySettings: Record<string, unknown> | null;
  todayCard: any | null;
  recentRequests: any[];

  // Meta
  lastFetchedAt: string | null;
  isOffline: boolean;

  // Offline write queue
  writeQueue: OfflineWriteItem[];

  // Actions
  cacheSchedule: (schedule: any, assignments: any[]) => void;
  cacheToday: (data: any) => void;
  cacheFamilySettings: (settings: Record<string, unknown>) => void;
  cacheRequests: (requests: any[]) => void;
  setOffline: (offline: boolean) => void;
  addToWriteQueue: (item: Omit<OfflineWriteItem, 'id' | 'createdAt'>) => void;
  removeFromWriteQueue: (id: string) => void;
  clearWriteQueue: () => void;
  isStale: () => boolean;
}

export const useCacheStore = create<CacheState>()(
  persist(
    (set, get) => ({
      activeSchedule: null,
      assignments: [],
      familySettings: null,
      todayCard: null,
      recentRequests: [],
      lastFetchedAt: null,
      isOffline: false,
      writeQueue: [],

      cacheSchedule: (schedule, assignments) =>
        set({ activeSchedule: schedule, assignments, lastFetchedAt: new Date().toISOString() }),

      cacheToday: (data) =>
        set({ todayCard: data, lastFetchedAt: new Date().toISOString() }),

      cacheFamilySettings: (settings) =>
        set({ familySettings: settings }),

      cacheRequests: (requests) =>
        set({ recentRequests: requests }),

      setOffline: (offline) => set({ isOffline: offline }),

      addToWriteQueue: (item) =>
        set((state) => ({
          writeQueue: [
            ...state.writeQueue,
            {
              ...item,
              id: Math.random().toString(36).slice(2),
              createdAt: new Date().toISOString(),
            },
          ],
        })),

      removeFromWriteQueue: (id) =>
        set((state) => ({
          writeQueue: state.writeQueue.filter((i) => i.id !== id),
        })),

      clearWriteQueue: () => set({ writeQueue: [] }),

      isStale: () => {
        const { lastFetchedAt } = get();
        if (!lastFetchedAt) return true;
        const hourAgo = Date.now() - 3600_000;
        return new Date(lastFetchedAt).getTime() < hourAgo;
      },
    }),
    {
      name: 'adcp-offline-cache',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeSchedule: state.activeSchedule,
        assignments: state.assignments,
        familySettings: state.familySettings,
        todayCard: state.todayCard,
        recentRequests: state.recentRequests,
        lastFetchedAt: state.lastFetchedAt,
        writeQueue: state.writeQueue,
      }),
    },
  ),
);
