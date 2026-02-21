import { create } from 'zustand';
import * as SecureStore from '../utils/storage';
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

interface PendingInvite {
  membershipId: string;
  familyId: string;
  familyName: string | null;
  inviterName: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  family: Family | null;
  accessToken: string | null;
  parentNames: { parent_a: string; parent_b: string };
  pendingInvite: PendingInvite | null;

  setAuth: (user: User, accessToken: string) => void;
  setFamily: (family: Family) => void;
  setPendingInvite: (invite: PendingInvite | null) => void;
  checkForPendingInvites: () => Promise<void>;
  acceptPendingInvite: () => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  sendMagicLink: (email: string) => Promise<{ message: string }>;
  verifyMagicLink: (token: string) => Promise<{ isNewUser: boolean }>;
  restoreFamily: () => Promise<Family | null>;
  createFamily: (name: string, timezone: string) => Promise<Family>;
  fetchParentNames: (familyId: string) => Promise<void>;
}

const DEFAULT_PARENT_NAMES = { parent_a: 'Parent A', parent_b: 'Parent B' };

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  family: null,
  accessToken: null,
  parentNames: { ...DEFAULT_PARENT_NAMES },
  pendingInvite: null,

  setAuth: (user, accessToken) =>
    set({ isAuthenticated: true, user, accessToken }),

  setFamily: (family) => {
    set({ family });
    if (family) get().fetchParentNames(family.id);
  },

  setPendingInvite: (invite) => set({ pendingInvite: invite }),

  checkForPendingInvites: async () => {
    try {
      const { data } = await familiesApi.getMyInvites();
      const list = Array.isArray(data) ? data : [];
      if (list.length > 0) {
        const inv = list[0];
        set({
          pendingInvite: {
            membershipId: inv.membershipId,
            familyId: inv.familyId,
            familyName: inv.familyName,
            inviterName: inv.inviterName,
          },
        });
      }
    } catch {
      // Silently ignore — not critical
    }
  },

  acceptPendingInvite: async () => {
    const invite = get().pendingInvite;
    if (!invite) return;
    const { data } = await familiesApi.acceptInviteById(invite.membershipId);
    const family: Family = {
      id: data.family.id,
      name: data.family.name,
      status: data.family.status,
    };
    await SecureStore.setItemAsync('familyId', family.id);
    set({ family, pendingInvite: null });
    get().fetchParentNames(family.id);
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('familyId');
    set({
      isAuthenticated: false,
      user: null,
      family: null,
      accessToken: null,
      parentNames: { ...DEFAULT_PARENT_NAMES },
      pendingInvite: null,
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

      // Try to restore family from stored ID first, then from API
      const familyId = await SecureStore.getItemAsync('familyId');
      if (familyId) {
        try {
          const { data: family } = await familiesApi.getFamily(familyId);
          set({ family });
          get().fetchParentNames(familyId);
        } catch {
          // Family not found, clear stored ID and try API lookup
          await SecureStore.deleteItemAsync('familyId');
          await get().restoreFamily();
        }
      } else {
        await get().restoreFamily();
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

  restoreFamily: async () => {
    try {
      const { data } = await authApi.getMyFamily();
      if (data) {
        const family: Family = {
          id: data.family.id,
          name: data.family.name,
          status: data.family.status,
        };
        await SecureStore.setItemAsync('familyId', family.id);
        set({ family });
        get().fetchParentNames(family.id);
        return family;
      }
    } catch {
      // No family found
    }
    return null;
  },

  createFamily: async (name: string, timezone: string) => {
    const { data } = await familiesApi.create({ name, timezone });
    const family: Family = {
      id: data.id,
      name: data.name,
      status: data.status,
    };
    await SecureStore.setItemAsync('familyId', family.id);
    const currentUser = get().user;
    set({
      family,
      parentNames: {
        parent_a: currentUser?.displayName || 'Parent A',
        parent_b: 'Parent B',
      },
    });
    return family;
  },

  fetchParentNames: async (familyId: string) => {
    try {
      const { data } = await familiesApi.getMembers(familyId);
      const members = Array.isArray(data) ? data : data.members || [];
      const names = { ...DEFAULT_PARENT_NAMES };
      for (const m of members) {
        const role = m.role as string;
        if (role === 'parent_a' || role === 'parent_b') {
          const displayName = m.user?.displayName;
          if (displayName) names[role] = displayName;
        }
      }
      set({ parentNames: names });
    } catch {
      // Keep defaults on error
    }
  },
}));
