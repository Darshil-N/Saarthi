import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import EngineerSidebar from './EngineerSidebar';
import { SidebarProvider, useSidebar } from '../SidebarContext';
import { Menu } from 'lucide-react';

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
            <span className="text-xs bg-teal-100 text-teal-700 font-semibold px-3 py-1 rounded-full">
              Engineer
            </span>
          </div>
        </header>
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
