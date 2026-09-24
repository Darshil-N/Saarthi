import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import supabase from '@/lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Call real backend POST /auth/login
      const { data } = await api.post('/auth/login', { email, password });

      // data = { access_token, refresh_token, token_type, role, user_id, email }
      const session = { access_token: data.access_token, refresh_token: data.refresh_token };
      const user = { full_name: data.email, id: data.user_id, email: data.email };
      const role = data.role;

      // Persist for the api.js interceptor
      localStorage.setItem('mock_auth', JSON.stringify({ session, user, role }));

      // Also establish a real Supabase client session so RLS-gated direct
      // Supabase queries (Admin/Accounts/Engineer dashboards) can see data.
      await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      login(session, user, role);

      // Route by role
      if (role === 'entry_operator') navigate('/entry');
      else if (role === 'engineer') navigate('/engineer');
      else if (role === 'accounts') navigate('/accounts');
      else if (role === 'admin') navigate('/admin');
      else navigate('/entry');

    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Failed to sign in. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <Droplets className="h-12 w-12 text-blue-600" />
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Saarthi
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 font-medium">
          Sign in to your account
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-slate-200">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm font-medium">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="email">Email address</Label>
              <div className="mt-1">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@bharatoil.com"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="mt-1 relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  placeholder="Your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Eye className="h-5 w-5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
