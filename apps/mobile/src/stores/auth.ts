import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  displayName: string;
}

interface Family {
  id: string;
  name: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  family: Family | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  setFamily: (family: Family) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  family: null,
  accessToken: null,
  setAuth: (user, accessToken) =>
    set({ isAuthenticated: true, user, accessToken }),
  setFamily: (family) => set({ family }),
  logout: () =>
    set({
      isAuthenticated: false,
      user: null,
      family: null,
      accessToken: null,
    }),
}));
