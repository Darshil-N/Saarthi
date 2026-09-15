import { create } from 'zustand';

/**
 * Auth Store (Zustand)
 * Provides authentication state and role identity for the application.
 * Currently uses a development placeholder for the 'engineer' role.
 * Structured to seamlessly bind to Supabase Auth sessions in Phase 1.3 / backend integration.
 */
export const useAuthStore = create((set) => ({
  // Development engineer identity - conforms to profiles table in architecture.md §5.1
  user: {
    id: 'dev-engineer-001',
    full_name: 'P. V. Ramana (Lead Maintenance Engineer)',
    role: 'engineer',
    department: 'MECH-DEPT',
    employee_id: 'BO-ENG-1084',
    email: 'engineer@bharatoil.in',
  },
  isAuthenticated: true,
  isLoading: false,

  // Action to update session when Supabase Auth is connected
  setSession: (user, isAuthenticated = true) => set({ user, isAuthenticated, isLoading: false }),

  // Action to clear session
  clearSession: () => set({ user: null, isAuthenticated: false, isLoading: false }),

  // Set loading status during auth check
  setLoading: (isLoading) => set({ isLoading }),
}));

export default useAuthStore;
