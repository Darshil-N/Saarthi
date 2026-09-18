/**
 * BharatOil Engineering Dashboard Aggregations (Mock Data)
 * Conforms to Saarthi architecture GET /dashboard/engineer contract (architecture.md §8 & §9.3)
 */

export const mockDashboardMetrics = {
  totalMaterials: {
    value: 1248,
    label: "Total Materials",
    supportingText: "Approved in master catalog",
    scope: "BharatOil Master",
  },
  lowStockItems: {
    value: 37,
    label: "Low Stock Items",
    supportingText: "Below configured reorder level",
    criticalCount: 8,
  },
  recentQueries: {
    value: 12,
    label: "My Recent Queries",
    supportingText: "Queries logged this period",
    period: "Last 7 Days",
  },
  pendingRequisitions: {
    value: "Not configured",
    label: "Pending Requisitions",
    supportingText: "Not part of current material model",
    isConfigured: false,
  },
  warehouseOverview: [
    {
      code: "WHSE-A",
      name: "Main Warehouse",
      focus: "Mechanical (Fasteners, Pipes, Valves)",
      department: "MECH-STORE",
      materialsStored: 642,
      lowStockCount: 18,
      totalBins: 48,
      occupiedBins: 42,
    },
    {
      code: "WHSE-B",
      name: "Electrical Store",
      focus: "Electrical (Cables, Motors, Panels, Instruments)",
      department: "ELEC-STORE",
      materialsStored: 381,
      lowStockCount: 11,
      totalBins: 28,
      occupiedBins: 24,
    },
    {
      code: "WHSE-C",
      name: "Chemical & Consumables",
      focus: "Chemicals, Lubricants, PPE & Tools",
      department: "CHEM-STORE",
      materialsStored: 225,
      lowStockCount: 8,
      totalBins: 28,
      occupiedBins: 21,
    },
  ],
  popularSearches: [
    { query: "Where are M8 stainless bolts?", count: 48 },
    { query: "How many gate valves are in stock?", count: 32 },
    { query: "Which location has the most pipe fittings?", count: 26 },
    { query: "3 Phase Induction Motor 5HP stock", count: 19 },
    { query: "Turbine Oil ISO VG 46 WHSE-C", count: 15 },
  ],
};

export default mockDashboardMetrics;
