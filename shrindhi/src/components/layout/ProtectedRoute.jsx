import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Navbar } from './Navbar';

export function ProtectedRoute({ requiredRole = 'engineer' }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans text-xs text-slate-500">
        Loading engineering session...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== requiredRole) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900 mb-1">Access Restricted</h2>
          <p className="text-xs text-slate-600 mb-3">
            The role <strong>{user.role}</strong> does not have authorization for the Engineering Dashboard.
          </p>
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs font-mono text-slate-600">
            Required Role: {requiredRole}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Top Task Bar / Navigation Bar */}
      <Navbar />

      {/* Main Content Full Width Container */}
      <main className="flex-1 w-full p-4 sm:p-6 lg:p-8">
        <div className="max-w-[1440px] mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Subtle Corporate Footer */}
      <footer className="py-4 px-6 border-t border-slate-200 bg-white text-center text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="font-semibold text-slate-800">NUMM</span>
            <span>•</span>
            <span>BharatOil Corporation Limited</span>
            <span>•</span>
            <span>Standard CNMC IS:1364</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Unified Material Master for Indian Public Sector Undertakings (CPSE)
          </div>
        </div>
      </footer>
    </div>
  );
}

export default ProtectedRoute;
