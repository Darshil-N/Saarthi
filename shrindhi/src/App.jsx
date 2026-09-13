import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { EngineerDashboard } from './pages/engineer/EngineerDashboard';
import { NLQuery } from './pages/engineer/NLQuery';
import { MaterialCatalog } from './pages/engineer/MaterialCatalog';
import { MaterialDetail } from './pages/engineer/MaterialDetail';
import { InventoryMap } from './pages/engineer/InventoryMap';
import { MyQueries } from './pages/engineer/MyQueries';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Default route redirect to engineer portal */}
        <Route path="/" element={<Navigate to="/engineer" replace />} />

        {/* Protected Engineer Routes Shell */}
        <Route path="/engineer" element={<ProtectedRoute requiredRole="engineer" />}>
          <Route index element={<EngineerDashboard />} />
          <Route path="find-material" element={<NLQuery />} />
          <Route path="catalog" element={<MaterialCatalog />} />
          <Route path="material/:id" element={<MaterialDetail />} />
          <Route path="inventory-map" element={<InventoryMap />} />
          <Route path="queries" element={<MyQueries />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/engineer" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
