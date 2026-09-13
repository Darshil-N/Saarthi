import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';

export function useAuth() {
  const { user, role, session, login, logout } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mock authentication check for local development without Supabase
    const initAuth = async () => {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const storedAuth = localStorage.getItem('mock_auth');
      if (storedAuth) {
        const { session, user, role } = JSON.parse(storedAuth);
        login(session, user, role);
      } else {
        logout();
      }
      setIsLoading(false);
    };

    initAuth();
  }, [login, logout]);

  return { user, role, session, isLoading };
}
