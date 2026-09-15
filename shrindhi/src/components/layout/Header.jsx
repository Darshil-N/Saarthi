import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function Header() {
  const { user } = useAuth();
  const location = useLocation();

  const getSectionTitle = (pathname) => {
    if (pathname === '/engineer') return 'Engineering Dashboard';
    if (pathname.startsWith('/engineer/find-material')) return 'Find Material';
    if (pathname.startsWith('/engineer/catalog')) return 'Material Catalog';
    if (pathname.startsWith('/engineer/material')) return 'Material Specification';
    if (pathname.startsWith('/engineer/inventory-map')) return 'Inventory Map';
    if (pathname.startsWith('/engineer/queries')) return 'My Queries';
    return 'Engineering Console';
  };

  return (
    <header className="h-14 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
      {/* Left: Section Identity */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-slate-900 tracking-tight">
          {getSectionTitle(location.pathname)}
        </h1>
        <span className="text-slate-300 font-normal">|</span>
        <span className="text-xs text-slate-500 font-sans">
          BharatOil Material Operations
        </span>
      </div>

      {/* Right: Environment, Role, User Profile */}
      <div className="flex items-center gap-4">
        <span className="px-2 py-0.5 rounded text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200">
          Prototype
        </span>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Engineer:</span>
          <span className="font-medium text-slate-900">
            {user?.full_name ? user.full_name.split('(')[0].trim() : 'P.V. Ramana'}
          </span>
          <span className="text-slate-400 font-mono text-[11px]">
            ({user?.department || 'MECH-DEPT'})
          </span>
        </div>
      </div>
    </header>
  );
}

export default Header;
