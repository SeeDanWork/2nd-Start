import { create } from 'zustand';
import { apiClient } from '../api/client';

interface UserAuth {
  email: string;
  accessToken: string;
  refreshToken: string;
  userId: string;
  displayName: string;
}

interface HarnessState {
  father: UserAuth | null;
  mother: UserAuth | null;
  familyId: string | null;
  isSettingUp: boolean;
  error: string | null;

  setup: () => Promise<void>;
  setFamilyId: (id: string) => void;
  refresh: () => void;
  /** Incremented to trigger panel re-fetches */
  refreshCounter: number;
}

export const useHarnessStore = create<HarnessState>((set, get) => ({
  father: null,
  mother: null,
  familyId: null,
  isSettingUp: false,
  error: null,
  refreshCounter: 0,

  setup: async () => {
    set({ isSettingUp: true, error: null });
    try {
      const fatherEmail = import.meta.env.VITE_FATHER_EMAIL || 'father@test.local';
      const motherEmail = import.meta.env.VITE_MOTHER_EMAIL || 'mother@test.local';

      const [fatherRes, motherRes] = await Promise.all([
        apiClient.post('/auth/dev-login', { email: fatherEmail }),
        apiClient.post('/auth/dev-login', { email: motherEmail }),
      ]);

      const father: UserAuth = {
        email: fatherEmail,
        accessToken: fatherRes.data.accessToken,
        refreshToken: fatherRes.data.refreshToken,
        userId: fatherRes.data.user.id,
        displayName: fatherRes.data.user.displayName,
      };

      const mother: UserAuth = {
        email: motherEmail,
        accessToken: motherRes.data.accessToken,
        refreshToken: motherRes.data.refreshToken,
        userId: motherRes.data.user.id,
        displayName: motherRes.data.user.displayName,
      };

      set({ father, mother, isSettingUp: false });
    } catch (err: any) {
      set({
        isSettingUp: false,
        error: err?.response?.data?.message || err.message || 'Setup failed',
      });
    }
  },

  setFamilyId: (id) => set({ familyId: id }),

  refresh: () => set((s) => ({ refreshCounter: s.refreshCounter + 1 })),
}));
