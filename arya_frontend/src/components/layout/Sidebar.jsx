import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Droplets, Home, FileText, CheckCircle2, History, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/entry', label: 'Home', icon: Home, end: true },
  { to: '/entry/new-receipt', label: 'New Receipt', icon: FileText },
  { to: '/entry/approvals', label: 'Pending Approvals', icon: CheckCircle2 },
  { to: '/entry/history', label: 'Receipt History', icon: History },
  { to: '/entry/locations', label: 'Locations', icon: MapPin },
];

export default function Sidebar() {
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
            <div className="text-xs text-slate-400 leading-tight">BharatOil</div>
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
