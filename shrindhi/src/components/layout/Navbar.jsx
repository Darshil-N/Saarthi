import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Layers, 
  MapPin, 
  Clock, 
  HardHat, 
  Sparkles,
  Command,
  ArrowRight
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
    badge: 'NL Search',
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

export function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-200/90 shadow-xs">
      {/* 1. Petroleum CPSE Tricolor Accent Strip */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-900 via-blue-600 to-amber-500" />

      {/* 2. Main Navigation Bar */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left: Branding Block */}
          <div 
            onClick={() => navigate('/engineer')} 
            className="flex items-center gap-3 cursor-pointer select-none shrink-0 group"
          >
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-950 text-amber-400 font-mono font-bold text-sm flex items-center justify-center shadow-sm border border-blue-700/50 group-hover:scale-105 transition-transform">
              BO
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tracking-tight font-mono">
                  Saarthi
                </span>
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20 font-mono">
                  BharatOil
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Unified Material Master
              </p>
            </div>
          </div>

          {/* Center: The Top Task Bar / Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-lg border border-slate-200/80">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                      isActive
                        ? 'bg-blue-700 text-white font-semibold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className={cn('w-3.5 h-3.5', isActive ? 'text-white' : 'text-slate-500')} />
                      <span>{item.label}</span>
                      {item.badge && (
                        <span
                          className={cn(
                            'text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-bold',
                            isActive
                              ? 'bg-blue-800/80 text-blue-100 border border-blue-400/30'
                              : 'bg-amber-100 text-amber-800 border border-amber-300/40'
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Right: Quick Search + User Profile & Prototype Status */}
          <div className="flex items-center gap-3">
            {/* Quick Find Button */}
            <button
              type="button"
              onClick={() => navigate('/engineer/find-material')}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-blue-900 border border-slate-200 text-xs transition-colors shadow-2xs"
            >
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Quick Search...</span>
              <kbd className="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300 text-slate-500">
                /
              </kbd>
            </button>

            {/* Prototype Indicator with Pulse */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[11px] font-mono text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Mock</span>
            </div>

            {/* User Profile Card */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white font-semibold text-xs flex items-center justify-center shadow-xs">
                {user?.full_name ? user.full_name.charAt(0) : 'P'}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-900">
                    {user?.full_name ? user.full_name.split('(')[0].trim() : 'P.V. Ramana'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-mono font-medium">
                    Engineer
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {user?.department || 'MECH-DEPT'} • {user?.employee_id || 'BO-ENG-1084'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Bar (visible only on small screens) */}
        <div className="flex md:hidden items-center gap-1 overflow-x-auto py-2 border-t border-slate-100">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs whitespace-nowrap shrink-0',
                    isActive
                      ? 'bg-blue-700 text-white font-semibold'
                      : 'text-slate-600 hover:text-slate-900 bg-slate-50'
                  )
                }
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
