import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

import Landing from './pages/Landing';
import Login from './pages/Login';
import EntryDashboard from './pages/entry/EntryDashboard';
import EntryHome from './pages/entry/EntryHome';
import NewReceipt from './pages/entry/NewReceipt';
import PendingApprovals from './pages/entry/PendingApprovals';
import ReceiptHistory from './pages/entry/ReceiptHistory';
import { Locations, EngineerDashboard, AccountsDashboard, AdminDashboard } from './pages/Stubs';
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
        <Route path="/accounts" element={<AccountsDashboard />} />
      </Route>

      <Route element={<ProtectedRoute requiredRole="admin" />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
    </Routes>
  );
}

export default App;
