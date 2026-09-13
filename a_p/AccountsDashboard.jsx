import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AccountsSidebar from './AccountsSidebar';
// Import the existing Header from arya_frontend
import Header from '../arya_frontend/src/components/layout/Header';

export default function AccountsDashboard() {
  const location = useLocation();
  
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
      <div className="flex-1 flex flex-col ml-60 transition-all duration-300 relative">
        <Header title={getPageTitle()} />
        <main className="flex-1 overflow-y-auto p-6 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
