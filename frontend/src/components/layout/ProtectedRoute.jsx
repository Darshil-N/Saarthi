import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const ProtectedRoute = ({ requiredRole }) => {
  const { session, role, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    switch (role) {
      case 'entry_operator':
        return <Navigate to="/entry" replace />;
      case 'engineer':
        return <Navigate to="/engineer" replace />;
      case 'accounts':
        return <Navigate to="/accounts" replace />;
      case 'admin':
        return <Navigate to="/admin" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
