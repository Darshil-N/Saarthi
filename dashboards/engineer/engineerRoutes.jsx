// Engineer Dashboard Routes
// Usage: import engineerRoutes from './engineer/engineerRoutes';
// Then spread into your main App.jsx router config.

import EngineerDashboard from './EngineerDashboard';
import EngineerHome from './EngineerHome';
import NLQuery from './NLQuery';
import MaterialCatalog from './MaterialCatalog';
import InventoryMap from './InventoryMap';

const engineerRoutes = {
  path: '/engineer',
  element: <EngineerDashboard />,
  children: [
    { index: true, element: <EngineerHome /> },
    { path: 'nl-query', element: <NLQuery /> },
    { path: 'catalog', element: <MaterialCatalog /> },
    { path: 'inventory-map', element: <InventoryMap /> },
  ],
};

export default engineerRoutes;
