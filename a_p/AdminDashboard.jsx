import React from 'react';
import { Outlet as RouterOutlet, useLocation as useRouterLocation } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { Menu } from 'lucide-react';

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
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center gap-3 shadow-sm">
          <button
            onClick={toggle}
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-slate-800">{getPageTitle(location.pathname)}</h1>
              <p className="text-xs text-slate-400">BharatOil Inventory Management System</p>
            </div>
            <span className="text-xs bg-indigo-100 text-indigo-700 font-semibold px-3 py-1 rounded-full">
              Admin
            </span>
          </div>
        </header>
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
