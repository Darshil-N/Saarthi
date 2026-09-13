import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default function EntryDashboard() {
  const location = useLocation();
  
  const getPageTitle = () => {
    switch(location.pathname) {
      case '/entry': return 'Home';
      case '/entry/new-receipt': return 'New Receipt';
      case '/entry/approvals': return 'Pending Approvals';
      case '/entry/history': return 'Receipt History';
      case '/entry/locations': return 'Locations Management';
      default: return 'Entry Dashboard';
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar />
      {/* Main content wrapper with margin left to accommodate the fixed sidebar */}
      {/* Assuming Sidebar is w-60 (240px) when open, and w-16 (64px) when closed. 
          To handle responsive/collapsible perfectly, we need state lifted or css variables.
          For now, adding margin left for default w-60.
      */}
      <div className="flex-1 flex flex-col ml-60 transition-all duration-300 relative">
        <Header title={getPageTitle()} />
        <main className="flex-1 overflow-y-auto p-6 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
