import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Layers, 
  MapPin, 
  Clock
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  {
    label: 'Home',
    path: '/engineer',
    icon: Home,
    end: true,
  },
  {
    label: 'Find Material',
    path: '/engineer/find-material',
    icon: Search,
    end: false,
  },
  {
    label: 'Browse Catalog',
    path: '/engineer/catalog',
    icon: Layers,
    end: false,
  },
  {
    label: 'Inventory Map',
    path: '/engineer/inventory-map',
    icon: MapPin,
    end: false,
  },
  {
    label: 'My Queries',
    path: '/engineer/queries',
    icon: Clock,
    end: false,
  },
];

export function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="w-[230px] bg-white border-r border-slate-200 flex flex-col h-screen shrink-0 select-none">
      {/* 1. Compact Identity Block */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
            BO
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-bold text-slate-900 text-sm tracking-tight font-mono">Saarthi</span>
              <span className="text-[10px] text-slate-400 font-sans font-medium">BharatOil</span>
            </div>
            <div className="text-[10px] text-slate-500 font-sans truncate mt-0.5">
              Material Master
            </div>
          </div>
        </div>
      </div>

      {/* 2. Navigation Items */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
          Operations
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-r transition-colors',
                  isActive
                    ? 'bg-blue-50/80 text-blue-900 font-semibold border-l-[3px] border-blue-700 -ml-2.5 pl-[17px]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 border-l-[3px] border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      isActive ? 'text-blue-700' : 'text-slate-400'
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* 3. Subtle Bottom Engineer Identity */}
      <div className="p-3 border-t border-slate-200 text-xs">
        <div className="font-semibold text-slate-900 tracking-wider text-[11px] uppercase">
          Engineer
        </div>
        <div className="text-[11px] text-slate-500 font-sans mt-0.5">
          Engineering Operations
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
