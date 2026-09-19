import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import EngineerSidebar from './EngineerSidebar';
import { SidebarProvider, useSidebar } from '../SidebarContext';
import { Menu } from 'lucide-react';
import Header from '../../arya_frontend/src/components/layout/Header';

const getPageTitle = (pathname) => {
  switch (true) {
    case pathname === '/engineer': return 'Engineer Dashboard';
    case pathname.startsWith('/engineer/nl-query'): return 'NL Query — Material Search';
    case pathname.startsWith('/engineer/catalog'): return 'Material Catalog';
    case pathname.startsWith('/engineer/inventory-map'): return 'Inventory Map';
    default: return 'Engineer Dashboard';
  }
};

function EngineerShell() {
  const location = useLocation();
  const { toggle } = useSidebar();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <EngineerSidebar />
      <div className="flex-1 flex flex-col md:ml-60 transition-all duration-300 relative">
        {/* Header */}
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function EngineerDashboard() {
  return (
    <SidebarProvider>
      <EngineerShell />
    </SidebarProvider>
  );
}
