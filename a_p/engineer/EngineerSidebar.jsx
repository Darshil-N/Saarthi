import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSidebar } from '../SidebarContext';
import {
  Wrench,
  Home,
  MessageSquare,
  BookOpen,
  Map,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const navItems = [
  { to: '/engineer', label: 'Home', icon: Home, end: true },
  { to: '/engineer/nl-query', label: 'NL Query', icon: MessageSquare },
  { to: '/engineer/catalog', label: 'Material Catalog', icon: BookOpen },
  { to: '/engineer/inventory-map', label: 'Inventory Map', icon: Map },
];

export default function EngineerSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { mobileOpen, close } = useSidebar();
  const location = useLocation();

  React.useEffect(() => { close(); }, [location.pathname]);

  return (
    <>
      {mobileOpen && (
        <div className="sidebar-backdrop md:hidden" onClick={close} />
      )}
      <aside className={cn(
        'fixed left-0 top-0 h-full bg-slate-900 text-white flex flex-col transition-all duration-300 z-40',
        'max-md:translate-x-[-100%] max-md:w-72',
        mobileOpen && 'max-md:translate-x-0',
        collapsed ? 'md:w-16' : 'md:w-60'
      )}>
      {/* Logo */}
      <div className={cn('flex items-center gap-2 px-4 py-5 border-b border-slate-700', collapsed && 'justify-center px-2')}>
        <Wrench className="h-7 w-7 text-teal-400 shrink-0" />
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-bold text-lg leading-tight">NUMM</div>
            <div className="text-xs text-slate-400 leading-tight">BharatOil Engineering</div>
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
                ? 'bg-teal-600 text-white'
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
    </>
  );
}
