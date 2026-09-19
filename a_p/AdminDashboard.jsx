import React from 'react';
import { Outlet as RouterOutlet, useLocation as useRouterLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { Menu } from 'lucide-react';
import Header from '../arya_frontend/src/components/layout/Header';

const getPageTitle = (pathname) => {
  switch (true) {
    case pathname === '/admin': return 'Admin Dashboard';
    case pathname.startsWith('/admin/material-governance'): return 'Material Governance';
    case pathname.startsWith('/admin/audit-trail'): return 'Audit Trail';
    case pathname.startsWith('/admin/duplicate-detection'): return 'Duplicate Detection';
    case pathname.startsWith('/admin/user-management'): return 'User Management';
    case pathname.startsWith('/admin/system-health'): return 'System Health';
    default: return 'Admin Dashboard';
  }
};

function AdminShell() {
  const location = useRouterLocation();
  const { toggle } = useSidebar();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <AdminSidebar />
      <div className="flex-1 flex flex-col md:ml-60 transition-all duration-300 relative">
        <div className="flex items-center">
          <button
            onClick={toggle}
            className="md:hidden p-2 ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <Header title={getPageTitle(location.pathname)} />
          </div>
        </div>
        <main key={location.pathname} className="flex-1 overflow-y-auto p-6 page-fade-in">
          <RouterOutlet />
        </main>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <SidebarProvider>
      <AdminShell />
    </SidebarProvider>
  );
}
