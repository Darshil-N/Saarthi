/**
 * BharatOil NL Query Log & History (Mock Data)
 * Conforms strictly to Saarthi schema: nl_query_log table (architecture.md §5.1)
 */

export const mockQueries = [
  {
    id: "LOG-1081",
    user_id: "dev-engineer-001",
    natural_language_query: "Where are M8 stainless bolts?",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       (inv.quantity - inv.reserved_quantity) AS available_quantity, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND m.standard_description ILIKE '%M8%stainless%bolt%'
ORDER BY inv.quantity DESC;`,
    query_result_count: 3,
    execution_time_ms: 142,
    was_successful: true,
    created_at: "2026-03-12T17:15:00Z",
    explanation: "Locating approved M8 stainless steel bolts across warehouse storage bins sorted by available quantity.",
  },
  {
    id: "LOG-1082",
    user_id: "dev-engineer-001",
    natural_language_query: "How many gate valves are in stock?",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       (inv.quantity - inv.reserved_quantity) AS available_quantity, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND m.subcategory = 'VALVE' AND m.material_type = 'GATE'
ORDER BY inv.quantity DESC;`,
    query_result_count: 4,
    execution_time_ms: 118,
    was_successful: true,
    created_at: "2026-03-12T16:40:00Z",
    explanation: "Retrieving stock levels and bin locations for all approved gate valve variants.",
  },
  {
    id: "LOG-1083",
    user_id: "dev-engineer-001",
    natural_language_query: "Which location has the most pipe fittings?",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       (inv.quantity - inv.reserved_quantity) AS available_quantity, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND m.subcategory = 'PIPE' AND m.material_type IN ('ELBOW', 'TEE', 'FLANGE', 'REDUCER', 'NIPPLE')
ORDER BY inv.quantity DESC;`,
    query_result_count: 6,
    execution_time_ms: 156,
    was_successful: true,
    created_at: "2026-03-12T14:10:00Z",
    explanation: "Finding pipe fittings (elbows, tees, flanges, reducers) ordered by highest available stock per bin.",
  },
  {
    id: "LOG-1084",
    user_id: "dev-engineer-001",
    natural_language_query: "Find all Class 150 flanged valves",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       inv.quantity, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND m.subcategory = 'VALVE' AND m.standard_description ILIKE '%Class 150%'
ORDER BY inv.quantity DESC;`,
    query_result_count: 3,
    execution_time_ms: 130,
    was_successful: true,
    created_at: "2026-03-11T16:20:00Z",
    explanation: "Filtered valves meeting Class 150 flanged specifications.",
  },
  {
    id: "LOG-1085",
    user_id: "dev-engineer-001",
    natural_language_query: "Check inventory for 3-Phase 5HP induction motors",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       inv.quantity, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND m.subcategory = 'MOTOR' AND m.spec ILIKE '%5HP%'
ORDER BY inv.quantity DESC;`,
    query_result_count: 2,
    execution_time_ms: 125,
    was_successful: true,
    created_at: "2026-03-11T11:05:00Z",
    explanation: "Querying 5HP 3-phase induction motors located in Electrical Store (WHSE-B).",
  },
  {
    id: "LOG-1086",
    user_id: "dev-engineer-001",
    natural_language_query: "What lubricants are stored in WHSE-C?",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       inv.quantity, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND l.warehouse = 'WHSE-C' AND m.subcategory = 'LUBR'
ORDER BY inv.quantity DESC;`,
    query_result_count: 4,
    execution_time_ms: 138,
    was_successful: true,
    created_at: "2026-03-10T15:50:00Z",
    explanation: "Listing all engine, turbine, and hydraulic lubricants in WHSE-C.",
  },
  {
    id: "LOG-1087",
    user_id: "dev-engineer-001",
    natural_language_query: "Show low stock electrical cables",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       inv.quantity, inv.reorder_level, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND m.subcategory = 'CABLE' AND inv.quantity <= inv.reorder_level;`,
    query_result_count: 1,
    execution_time_ms: 110,
    was_successful: true,
    created_at: "2026-03-10T10:15:00Z",
    explanation: "Filtering electrical cables at or below minimum reorder threshold.",
  },
  {
    id: "LOG-1088",
    user_id: "dev-engineer-001",
    natural_language_query: "Where are E7018 welding electrodes?",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       inv.quantity, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND m.spec ILIKE '%E7018%'
ORDER BY inv.quantity DESC;`,
    query_result_count: 1,
    execution_time_ms: 95,
    was_successful: true,
    created_at: "2026-03-09T14:25:00Z",
    explanation: "Located AWS E7018 welding electrodes in WHSE-C Aisle 3.",
  },
  {
    id: "LOG-1089",
    user_id: "dev-engineer-001",
    natural_language_query: "Find SS316 spiral wound gaskets 2 inch",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       inv.quantity, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND m.subcategory = 'SEAL' AND m.spec ILIKE '%2IN-150-SS316%'
ORDER BY inv.quantity DESC;`,
    query_result_count: 1,
    execution_time_ms: 120,
    was_successful: true,
    created_at: "2026-03-08T16:00:00Z",
    explanation: "Located 2\" Class 150 spiral wound gaskets in WHSE-A Aisle 2.",
  },
  {
    id: "LOG-1090",
    user_id: "dev-engineer-001",
    natural_language_query: "List pressure transmitters with HART protocol",
    generated_sql: `SELECT m.standard_description, m.cnmc, l.warehouse, l.aisle, l.rack, l.bin, 
       inv.quantity, m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' AND m.subcategory = 'INSTRU' AND m.standard_description ILIKE '%HART%'
ORDER BY inv.quantity DESC;`,
    query_result_count: 1,
    execution_time_ms: 105,
    was_successful: true,
    created_at: "2026-03-07T11:40:00Z",
    explanation: "Found smart pressure transmitters with HART communications protocol in WHSE-B Aisle 3.",
  },
];

export default mockQueries;
