import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

import Landing from './pages/Landing';
import Login from './pages/Login';
import EntryDashboard from './pages/entry/EntryDashboard';
import EntryHome from './pages/entry/EntryHome';
import NewReceipt from './pages/entry/NewReceipt';
import PendingApprovals from './pages/entry/PendingApprovals';
import ReceiptHistory from './pages/entry/ReceiptHistory';
import { Locations, EngineerDashboard, AdminDashboard } from './pages/Stubs';
import AccountsDashboard from '../../a_p/AccountsDashboard';
import AccountsHome from '../../a_p/pages/AccountsHome';
import PriceIntelligence from '../../a_p/pages/PriceIntelligence';
import StockValuation from '../../a_p/pages/StockValuation';
import VendorAnalysis from '../../a_p/pages/VendorAnalysis';
import PurchaseHistory from '../../a_p/pages/PurchaseHistory';
import ProtectedRoute from './components/layout/ProtectedRoute';

function App() {
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
        <Route path="/engineer" element={<EngineerDashboard />} />
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
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
    </Routes>
  );
}

export default App;
