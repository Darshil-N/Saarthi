import axios from 'axios';

// VITE_API_BASE_URL points to the FastAPI backend service
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to attach JWT token when available
api.interceptors.request.use(
  (config) => {
    // In production, token is retrieved from session or localStorage
    const token = localStorage.getItem('saarthi_auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for unified error formatting
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Graceful error logging without crashing application
    console.warn('[API Service Notice]', error?.response?.status, error?.message);
    return Promise.reject(error);
  }
);

export default api;
