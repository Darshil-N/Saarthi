import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Shield, 
  Home, 
  Database, 
  Activity, 
  Users, 
  Copy, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const navItems = [
  { to: '/admin', label: 'Home', icon: Home, end: true },
  { to: '/admin/material-governance', label: 'Material Governance', icon: Database },
  { to: '/admin/audit-trail', label: 'Audit Trail', icon: Activity },
  { to: '/admin/duplicate-detection', label: 'Duplicate Detection', icon: Copy },
  { to: '/admin/user-management', label: 'User Management', icon: Users },
  { to: '/admin/system-health', label: 'System Health', icon: Shield },
];

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      'fixed left-0 top-0 h-full bg-slate-900 text-white flex flex-col transition-all duration-300 z-40',
      collapsed ? 'w-16' : 'w-60'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-2 px-4 py-5 border-b border-slate-700', collapsed && 'justify-center px-2')}>
        <Shield className="h-7 w-7 text-indigo-400 shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-bold text-lg leading-tight">NUMM</div>
            <div className="text-xs text-slate-400 leading-tight">BharatOil Admin</div>
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
                ? 'bg-indigo-600 text-white'
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
