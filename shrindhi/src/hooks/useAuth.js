import { useAuthStore } from '../store/authStore';

/**
 * useAuth Hook
 * Clean authentication abstraction for reading user identity and role.
 */
export function useAuth() {
  const { user, isAuthenticated, isLoading, setSession, clearSession } = useAuthStore();

  const isEngineer = user?.role === 'engineer';
  const role = user?.role || null;

  return {
    user,
    role,
    isEngineer,
    isAuthenticated,
    isLoading,
    setSession,
    clearSession,
  };
}

export default useAuth;
