import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  role: null,
  session: null,
  isLoading: true,
  login: (session, user, role) => set({ session, user, role, isLoading: false }),
  logout: () => {
    localStorage.removeItem('mock_auth');
    set({ session: null, user: null, role: null, isLoading: false });
  },
  setUser: (user) => set({ user }),
  init: () => {
    try {
      const stored = localStorage.getItem('mock_auth');
      if (stored) {
        const { session, user, role } = JSON.parse(stored);
        set({ session, user, role, isLoading: false });
        return;
      }
    } catch (e) {
      // corrupted localStorage entry — fall through to logged-out state
    }
    set({ session: null, user: null, role: null, isLoading: false });
  },
}));
