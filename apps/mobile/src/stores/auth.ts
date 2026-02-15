import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi, familiesApi } from '../api/client';

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface Family {
  id: string;
  name: string | null;
  status: string;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  family: Family | null;
  accessToken: string | null;

  setAuth: (user: User, accessToken: string) => void;
  setFamily: (family: Family) => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<{ message: string }>;
  verifyMagicLink: (token: string) => Promise<{ isNewUser: boolean }>;
  createFamily: (name: string, timezone: string) => Promise<Family>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  family: null,
  accessToken: null,

  setAuth: (user, accessToken) =>
    set({ isAuthenticated: true, user, accessToken }),

  setFamily: (family) => set({ family }),

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('familyId');
    set({
      isAuthenticated: false,
      user: null,
      family: null,
      accessToken: null,
    });
  },

  restoreSession: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      if (!token) {
        set({ isLoading: false });
        return;
      }

      const { data: user } = await authApi.getProfile();
      set({ isAuthenticated: true, user, accessToken: token });

      // Try to restore family
      const familyId = await SecureStore.getItemAsync('familyId');
      if (familyId) {
        try {
          const { data: family } = await familiesApi.getFamily(familyId);
          set({ family });
        } catch {
          // Family not found, clear stored ID
          await SecureStore.deleteItemAsync('familyId');
        }
      }
    } catch {
      // Token expired or invalid
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
    } finally {
      set({ isLoading: false });
    }
  },

  sendMagicLink: async (email: string) => {
    const { data } = await authApi.sendMagicLink(email);
    return data;
  },

  verifyMagicLink: async (token: string) => {
    const { data } = await authApi.verifyMagicLink(token);
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    set({
      isAuthenticated: true,
      user: data.user,
      accessToken: data.accessToken,
    });
    return { isNewUser: data.isNewUser };
  },

  createFamily: async (name: string, timezone: string) => {
    const { data } = await familiesApi.create({ name, timezone });
    const family: Family = {
      id: data.id,
      name: data.name,
      status: data.status,
    };
    await SecureStore.setItemAsync('familyId', family.id);
    set({ family });
    return family;
  },
}));
