import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  role: null,
  session: null,
  login: (session, user, role) => set({ session, user, role }),
  logout: () => set({ session: null, user: null, role: null }),
  setUser: (user) => set({ user }),
}));
