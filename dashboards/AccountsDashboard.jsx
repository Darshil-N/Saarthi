import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AccountsSidebar from './AccountsSidebar';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { Menu } from 'lucide-react';
// Import the existing Header from frontend
import Header from '../frontend/src/components/layout/Header';

function AccountsShell() {
  const location = useLocation();
  const { toggle } = useSidebar();
  
  const getPageTitle = () => {
    switch(location.pathname) {
      case '/accounts': return 'Accounts Dashboard';
      case '/accounts/price-intelligence': return 'Price Intelligence';
      case '/accounts/stock-valuation': return 'Stock Valuation';
      case '/accounts/vendor-analysis': return 'Vendor Analysis';
      case '/accounts/purchase-history': return 'Purchase History';
      default: return 'Accounts Dashboard';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <AccountsSidebar />
      <div className="flex-1 flex flex-col md:ml-60 transition-all duration-300 relative">
        {/* Mobile hamburger + shared Header (title, user, role, logout) */}
        <div className="flex items-center">
          <button
            onClick={toggle}
            className="md:hidden p-2 ml-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <Header title={getPageTitle()} />
          </div>
        </div>
        <main key={location.pathname} className="flex-1 overflow-y-auto p-6 relative page-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AccountsDashboard() {
  return (
    <SidebarProvider>
      <AccountsShell />
    </SidebarProvider>
  );
}
