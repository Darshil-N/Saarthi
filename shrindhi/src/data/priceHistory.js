/**
 * BharatOil Price History & Vendors (Mock Data)
 * Conforms strictly to Saarthi schema: price_history and vendors tables (architecture.md §5.1 & §13)
 */

export const mockVendors = [
  { id: "VND-001", name: "FastFix Industries", code: "VND-001", rating: 4.8, gstin: "27AAACF1234F1Z5", specialty: "Fasteners & Hardware" },
  { id: "VND-002", name: "PipePro Supplies", code: "VND-002", rating: 4.6, gstin: "27AABCP5678P1Z8", specialty: "Seamless Pipes & Fittings" },
  { id: "VND-003", name: "ValveTech India", code: "VND-003", rating: 4.9, gstin: "24AAACV9012V1Z2", specialty: "Industrial Valves" },
  { id: "VND-004", name: "ElectroCore Ltd", code: "VND-004", rating: 4.7, gstin: "06AAACE3456E1Z9", specialty: "Motors & Switchgear" },
  { id: "VND-005", name: "LubriMax India", code: "VND-005", rating: 4.5, gstin: "27AAACL7890L1Z4", specialty: "Industrial Lubricants & Oils" },
  { id: "VND-006", name: "SafeGear Pvt Ltd", code: "VND-006", rating: 4.4, gstin: "29AAACS2345S1Z7", specialty: "Personal Protective Equipment" },
  { id: "VND-007", name: "WeldPro Supplies", code: "VND-007", rating: 4.7, gstin: "27AAACW6789W1Z3", specialty: "Welding Consumables & Tools" },
  { id: "VND-008", name: "SteelCraft India", code: "VND-008", rating: 4.3, gstin: "03AAACS0123S1Z1", specialty: "Structural Steel" },
  { id: "VND-009", name: "ChemiFluid Ltd", code: "VND-009", rating: 4.5, gstin: "24AAACC4567C1Z6", specialty: "Chemicals & Solvents" },
  { id: "VND-010", name: "ToolMart India", code: "VND-010", rating: 4.6, gstin: "27AAACT8901T1Z0", specialty: "Workshop Hand Tools" },
];

export const mockPriceHistory = [
  // Hex Bolt M8x25 SS304 (MAT-MECH-001) - 12 Months
  { id: "PH-001", material_id: "MAT-MECH-001", vendor_id: "VND-001", vendor_name: "FastFix Industries", purchase_date: "2025-04-10", unit_price: 13.20, quantity: 1500, currency: "INR" },
  { id: "PH-002", material_id: "MAT-MECH-001", vendor_id: "VND-001", vendor_name: "FastFix Industries", purchase_date: "2025-06-18", unit_price: 13.50, quantity: 1000, currency: "INR" },
  { id: "PH-003", material_id: "MAT-MECH-001", vendor_id: "VND-008", vendor_name: "SteelCraft India", purchase_date: "2025-08-22", unit_price: 14.10, quantity: 800, currency: "INR" },
  { id: "PH-004", material_id: "MAT-MECH-001", vendor_id: "VND-001", vendor_name: "FastFix Industries", purchase_date: "2025-10-15", unit_price: 13.90, quantity: 2000, currency: "INR" },
  { id: "PH-005", material_id: "MAT-MECH-001", vendor_id: "VND-001", vendor_name: "FastFix Industries", purchase_date: "2025-12-04", unit_price: 14.20, quantity: 1200, currency: "INR" },
  { id: "PH-006", material_id: "MAT-MECH-001", vendor_id: "VND-001", vendor_name: "FastFix Industries", purchase_date: "2026-02-12", unit_price: 14.50, quantity: 1500, currency: "INR" },

  // Gate Valve 2 inch PN16 (MAT-MECH-013)
  { id: "PH-007", material_id: "MAT-MECH-013", vendor_id: "VND-003", vendor_name: "ValveTech India", purchase_date: "2025-05-14", unit_price: 4650.00, quantity: 30, currency: "INR" },
  { id: "PH-008", material_id: "MAT-MECH-013", vendor_id: "VND-003", vendor_name: "ValveTech India", purchase_date: "2025-08-19", unit_price: 4720.00, quantity: 25, currency: "INR" },
  { id: "PH-009", material_id: "MAT-MECH-013", vendor_id: "VND-002", vendor_name: "PipePro Supplies", purchase_date: "2025-11-10", unit_price: 4900.00, quantity: 20, currency: "INR" },
  { id: "PH-010", material_id: "MAT-MECH-013", vendor_id: "VND-003", vendor_name: "ValveTech India", purchase_date: "2026-01-25", unit_price: 4850.00, quantity: 35, currency: "INR" },

  // 3 Phase Motor 5HP (MAT-ELEC-022)
  { id: "PH-011", material_id: "MAT-ELEC-022", vendor_id: "VND-004", vendor_name: "ElectroCore Ltd", purchase_date: "2025-04-20", unit_price: 17500.00, quantity: 10, currency: "INR" },
  { id: "PH-012", material_id: "MAT-ELEC-022", vendor_id: "VND-004", vendor_name: "ElectroCore Ltd", purchase_date: "2025-09-12", unit_price: 18000.00, quantity: 8, currency: "INR" },
  { id: "PH-013", material_id: "MAT-ELEC-022", vendor_id: "VND-004", vendor_name: "ElectroCore Ltd", purchase_date: "2026-02-05", unit_price: 18200.00, quantity: 6, currency: "INR" },

  // Engine Oil 15W-40 (MAT-CHEM-028)
  { id: "PH-014", material_id: "MAT-CHEM-028", vendor_id: "VND-005", vendor_name: "LubriMax India", purchase_date: "2025-06-01", unit_price: 265.00, quantity: 500, currency: "INR" },
  { id: "PH-015", material_id: "MAT-CHEM-028", vendor_id: "VND-005", vendor_name: "LubriMax India", purchase_date: "2025-10-18", unit_price: 275.00, quantity: 400, currency: "INR" },
  { id: "PH-016", material_id: "MAT-CHEM-028", vendor_id: "VND-005", vendor_name: "LubriMax India", purchase_date: "2026-01-14", unit_price: 280.00, quantity: 600, currency: "INR" },

  // 90 Deg LR Elbow 2" (MAT-MECH-010)
  { id: "PH-017", material_id: "MAT-MECH-010", vendor_id: "VND-002", vendor_name: "PipePro Supplies", purchase_date: "2025-05-10", unit_price: 340.00, quantity: 200, currency: "INR" },
  { id: "PH-018", material_id: "MAT-MECH-010", vendor_id: "VND-002", vendor_name: "PipePro Supplies", purchase_date: "2025-10-20", unit_price: 360.00, quantity: 150, currency: "INR" },
  { id: "PH-019", material_id: "MAT-MECH-010", vendor_id: "VND-002", vendor_name: "PipePro Supplies", purchase_date: "2026-02-18", unit_price: 365.00, quantity: 250, currency: "INR" },
];

export default mockPriceHistory;
