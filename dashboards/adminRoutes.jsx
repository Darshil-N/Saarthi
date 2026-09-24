// Admin Dashboard Routes
// Usage: import adminRoutes from './adminRoutes';
// Then spread into your main App.jsx router config.
//
// Example in App.jsx:
//   import { createBrowserRouter, RouterProvider } from 'react-router-dom';
//   import adminRoutes from '../dashboards/adminRoutes';
//   const router = createBrowserRouter([
//     ...existingRoutes,
//     adminRoutes,
//   ]);

import AdminDashboard from './AdminDashboard';
import AdminHome from './pages/AdminHome';
import MaterialGovernance from './pages/MaterialGovernance';
import AuditTrail from './pages/AuditTrail';
import DuplicateDetection from './pages/DuplicateDetection';
import UserManagement from './pages/UserManagement';
import SystemHealth from './pages/SystemHealth';

const adminRoutes = {
  path: '/admin',
  element: <AdminDashboard />,
  children: [
    { index: true, element: <AdminHome /> },
    { path: 'material-governance', element: <MaterialGovernance /> },
    { path: 'audit-trail', element: <AuditTrail /> },
    { path: 'duplicate-detection', element: <DuplicateDetection /> },
    { path: 'user-management', element: <UserManagement /> },
    { path: 'system-health', element: <SystemHealth /> },
  ],
};

export default adminRoutes;
