import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

import Landing from './pages/Landing';
import Login from './pages/Login';
import EntryDashboard from './pages/entry/EntryDashboard';
import EntryHome from './pages/entry/EntryHome';
import NewReceipt from './pages/entry/NewReceipt';
import PendingApprovals from './pages/entry/PendingApprovals';
import ReceiptHistory from './pages/entry/ReceiptHistory';
import { Locations } from './pages/Stubs';
import EngineerDashboard from '../../dashboards/engineer/EngineerDashboard';
import EngineerHome from '../../dashboards/engineer/EngineerHome';
import NLQuery from '../../dashboards/engineer/NLQuery';
import MaterialCatalog from '../../dashboards/engineer/MaterialCatalog';
import InventoryMap from '../../dashboards/engineer/InventoryMap';
import AccountsDashboard from '../../dashboards/AccountsDashboard';
import AccountsHome from '../../dashboards/pages/AccountsHome';
import PriceIntelligence from '../../dashboards/pages/PriceIntelligence';
import StockValuation from '../../dashboards/pages/StockValuation';
import VendorAnalysis from '../../dashboards/pages/VendorAnalysis';
import PurchaseHistory from '../../dashboards/pages/PurchaseHistory';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Admin Imports
import AdminDashboard from '../../dashboards/AdminDashboard';
import AdminHome from '../../dashboards/pages/AdminHome';
import MaterialGovernance from '../../dashboards/pages/MaterialGovernance';
import AuditTrail from '../../dashboards/pages/AuditTrail';
import DuplicateDetection from '../../dashboards/pages/DuplicateDetection';
import UserManagement from '../../dashboards/pages/UserManagement';
import SystemHealth from '../../dashboards/pages/SystemHealth';

function App() {
  const init = useAuthStore((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      
      <Route element={<ProtectedRoute requiredRole="entry_operator" />}>
        <Route path="/entry" element={<EntryDashboard />}>
          <Route index element={<EntryHome />} />
          <Route path="new-receipt" element={<NewReceipt />} />
          <Route path="approvals" element={<PendingApprovals />} />
          <Route path="history" element={<ReceiptHistory />} />
          <Route path="locations" element={<Locations />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredRole="engineer" />}>
        <Route path="/engineer" element={<EngineerDashboard />}>
          <Route index element={<EngineerHome />} />
          <Route path="nl-query" element={<NLQuery />} />
          <Route path="catalog" element={<MaterialCatalog />} />
          <Route path="inventory-map" element={<InventoryMap />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredRole="accounts" />}>
        <Route path="/accounts" element={<AccountsDashboard />}>
          <Route index element={<AccountsHome />} />
          <Route path="price-intelligence" element={<PriceIntelligence />} />
          <Route path="stock-valuation" element={<StockValuation />} />
          <Route path="vendor-analysis" element={<VendorAnalysis />} />
          <Route path="purchase-history" element={<PurchaseHistory />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute requiredRole="admin" />}>
        <Route path="/admin" element={<AdminDashboard />}>
          <Route index element={<AdminHome />} />
          <Route path="material-governance" element={<MaterialGovernance />} />
          <Route path="audit-trail" element={<AuditTrail />} />
          <Route path="duplicate-detection" element={<DuplicateDetection />} />
          <Route path="user-management" element={<UserManagement />} />
          <Route path="system-health" element={<SystemHealth />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
