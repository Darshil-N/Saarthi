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
import EngineerDashboard from '../../a_p/engineer/EngineerDashboard';
import EngineerHome from '../../a_p/engineer/EngineerHome';
import NLQuery from '../../a_p/engineer/NLQuery';
import MaterialCatalog from '../../a_p/engineer/MaterialCatalog';
import InventoryMap from '../../a_p/engineer/InventoryMap';
import AccountsDashboard from '../../a_p/AccountsDashboard';
import AccountsHome from '../../a_p/pages/AccountsHome';
import PriceIntelligence from '../../a_p/pages/PriceIntelligence';
import StockValuation from '../../a_p/pages/StockValuation';
import VendorAnalysis from '../../a_p/pages/VendorAnalysis';
import PurchaseHistory from '../../a_p/pages/PurchaseHistory';
import ProtectedRoute from './components/layout/ProtectedRoute';

// Admin Imports
import AdminDashboard from '../../a_p/AdminDashboard';
import AdminHome from '../../a_p/pages/AdminHome';
import MaterialGovernance from '../../a_p/pages/MaterialGovernance';
import AuditTrail from '../../a_p/pages/AuditTrail';
import DuplicateDetection from '../../a_p/pages/DuplicateDetection';
import UserManagement from '../../a_p/pages/UserManagement';
import SystemHealth from '../../a_p/pages/SystemHealth';

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
