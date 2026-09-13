import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Droplets, Home, TrendingDown, Package, Users, History, ChevronLeft, ChevronRight } from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const navItems = [
  { to: '/accounts', label: 'Home', icon: Home, end: true },
  { to: '/accounts/price-intelligence', label: 'Price Intelligence', icon: TrendingDown },
  { to: '/accounts/stock-valuation', label: 'Stock Valuation', icon: Package },
  { to: '/accounts/vendor-analysis', label: 'Vendor Analysis', icon: Users },
  { to: '/accounts/purchase-history', label: 'Purchase History', icon: History },
];

export default function AccountsSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full bg-slate-900 text-white flex flex-col transition-all duration-300 z-40',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-2 px-4 py-5 border-b border-slate-700', collapsed && 'justify-center px-2')}>
        <Droplets className="h-7 w-7 text-blue-400 shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-bold text-lg leading-tight">NUMM</div>
            <div className="text-xs text-slate-400 leading-tight">BharatOil Accounts</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              collapsed && 'justify-center px-2'
            )}
          >
            <Icon className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="p-3 border-t border-slate-700">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 px-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <><ChevronLeft className="h-4 w-4 mr-2" /><span className="text-sm">Collapse</span></>
          )}
        </button>
      </div>
    </aside>
  );
}
