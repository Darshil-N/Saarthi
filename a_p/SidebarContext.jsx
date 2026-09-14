import React, { createContext, useContext, useState, useCallback } from 'react';

const SidebarContext = createContext(null);

/**
 * Wrap a dashboard shell with this provider to share mobile-sidebar open state
 * between the Dashboard (which renders the hamburger button) and the Sidebar.
 */
export function SidebarProvider({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const open = useCallback(() => setMobileOpen(true), []);
  const close = useCallback(() => setMobileOpen(false), []);
  const toggle = useCallback(() => setMobileOpen(v => !v), []);
  return (
    <SidebarContext.Provider value={{ mobileOpen, open, close, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider');
  return ctx;
}
