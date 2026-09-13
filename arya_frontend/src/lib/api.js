import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
});

// Since we are mocking auth and don't have a real Supabase yet,
// we'll just inject the mock token from localStorage.
api.interceptors.request.use(async (config) => {
  const storedAuth = localStorage.getItem('mock_auth');
  if (storedAuth) {
    const { session } = JSON.parse(storedAuth);
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return config;
});

export default api;
