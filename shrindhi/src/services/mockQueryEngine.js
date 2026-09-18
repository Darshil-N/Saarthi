/**
 * BharatOil Local Deterministic NL Query Simulator
 * Simulates backend NL→SQL resolution against the canonical BharatOil schema
 * Tolerant to casing, spacing, and word order variations
 */

import { mockMaterials } from '../data/materials';
import { mockInventory } from '../data/inventory';

export function executeMockQuery(naturalLanguageQuery) {
  const query = naturalLanguageQuery.trim().toLowerCase();

  // Helper to join material and inventory details
  const getInventoryRows = (materialIds) => {
    const rows = [];
    for (const matId of materialIds) {
      const mat = mockMaterials.find((m) => m.id === matId);
      if (!mat) continue;
      const invList = mockInventory.filter((inv) => inv.material_id === matId);
      for (const inv of invList) {
        rows.push({
          material_id: mat.id,
          material: mat.standard_description,
          short_description: mat.short_description,
          cnmc: mat.cnmc,
          category: mat.category,
          subcategory: mat.subcategory,
          warehouse: inv.warehouse,
          aisle: inv.aisle,
          rack: inv.rack,
          bin: inv.bin,
          location_code: inv.location_code,
          quantity: inv.quantity,
          reserved_quantity: inv.reserved_quantity,
          available_quantity: inv.quantity - inv.reserved_quantity,
          unit: mat.unit_of_measure,
          reorder_level: inv.reorder_level,
        });
      }
    }
    // Always sort by quantity descending as specified in Saarthi
    return rows.sort((a, b) => b.available_quantity - a.available_quantity);
  };

  // --- Target Query 1: M8 Stainless Bolts ---
  if (
    query.includes('m8') &&
    (query.includes('bolt') || query.includes('fastener') || query.includes('stainless') || query.includes('where'))
  ) {
    const results = getInventoryRows(['MAT-MECH-001', 'MAT-MECH-002']);
    return {
      query: naturalLanguageQuery,
      interpretation: "Searching for approved M8 stainless steel bolts across BharatOil warehouse storage locations.",
      generatedSql: `SELECT 
  m.standard_description, 
  m.cnmc, 
  l.warehouse, 
  l.aisle, 
  l.rack, 
  l.bin, 
  (inv.quantity - inv.reserved_quantity) AS available_quantity, 
  m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' 
  AND m.category = 'MECH' 
  AND m.subcategory = 'FSTNR' 
  AND m.standard_description ILIKE '%M8%SS304%bolt%'
ORDER BY available_quantity DESC;`,
      executionTimeMs: 134,
      wasSuccessful: true,
      totalCount: results.length,
      results,
    };
  }

  // --- Target Query 2: Gate Valves ---
  if (
    query.includes('gate valve') ||
    (query.includes('valve') && (query.includes('how many') || query.includes('stock') || query.includes('gate')))
  ) {
    const results = getInventoryRows(['MAT-MECH-013', 'MAT-MECH-014', 'MAT-MECH-045']);
    const totalQty = results.reduce((acc, r) => acc + r.available_quantity, 0);
    return {
      query: naturalLanguageQuery,
      interpretation: `Calculating stock levels for approved Gate Valves across all locations. Found ${totalQty} units available.`,
      generatedSql: `SELECT 
  m.standard_description, 
  m.cnmc, 
  l.warehouse, 
  l.aisle, 
  l.rack, 
  l.bin, 
  (inv.quantity - inv.reserved_quantity) AS available_quantity, 
  m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' 
  AND m.category = 'MECH' 
  AND m.subcategory = 'VALVE' 
  AND m.material_type = 'GATE'
ORDER BY available_quantity DESC;`,
      executionTimeMs: 112,
      wasSuccessful: true,
      totalCount: results.length,
      results,
    };
  }

  // --- Target Query 3: Pipe Fittings Locations ---
  if (
    query.includes('pipe') ||
    query.includes('fitting') ||
    query.includes('elbow') ||
    query.includes('flange') ||
    query.includes('tee')
  ) {
    const results = getInventoryRows([
      'MAT-MECH-010', // 90 Deg LR Elbow 2"
      'MAT-MECH-011', // WN Flange 2" Cl150
      'MAT-MECH-012', // Equal Tee 2"
      'MAT-MECH-049', // Concentric Reducer 4x2
      'MAT-MECH-050', // Pipe Nipple 2"
      'MAT-MECH-008', // CS Pipe 2"
    ]);
    return {
      query: naturalLanguageQuery,
      interpretation: "Identifying warehouse storage bins with pipe fittings (elbows, tees, flanges, nipples) sorted by stock quantity.",
      generatedSql: `SELECT 
  m.standard_description, 
  m.cnmc, 
  l.warehouse, 
  l.aisle, 
  l.rack, 
  l.bin, 
  (inv.quantity - inv.reserved_quantity) AS available_quantity, 
  m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' 
  AND m.category = 'MECH' 
  AND m.subcategory = 'PIPE' 
  AND m.material_type IN ('ELBOW', 'TEE', 'FLANGE', 'REDUCER', 'NIPPLE', 'PIPE')
ORDER BY available_quantity DESC;`,
      executionTimeMs: 148,
      wasSuccessful: true,
      totalCount: results.length,
      results,
    };
  }

  // --- Query: Motors ---
  if (query.includes('motor') || query.includes('induction')) {
    const results = getInventoryRows(['MAT-ELEC-022', 'MAT-ELEC-023', 'MAT-ELEC-047']);
    return {
      query: naturalLanguageQuery,
      interpretation: "Searching for 3-Phase induction and flameproof electric motors in Electrical Store (WHSE-B).",
      generatedSql: `SELECT 
  m.standard_description, 
  m.cnmc, 
  l.warehouse, 
  l.aisle, 
  l.rack, 
  l.bin, 
  (inv.quantity - inv.reserved_quantity) AS available_quantity, 
  m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' 
  AND m.category = 'ELEC' 
  AND m.subcategory = 'MOTOR'
ORDER BY available_quantity DESC;`,
      executionTimeMs: 120,
      wasSuccessful: true,
      totalCount: results.length,
      results,
    };
  }

  // --- Query: Lubricants & Oils ---
  if (query.includes('oil') || query.includes('lubricant') || query.includes('grease')) {
    const results = getInventoryRows(['MAT-CHEM-028', 'MAT-CHEM-029', 'MAT-CHEM-030', 'MAT-CHEM-031']);
    return {
      query: naturalLanguageQuery,
      interpretation: "Listing engine oils, turbine oils, and lubricants located in Chemical & Consumables Store (WHSE-C).",
      generatedSql: `SELECT 
  m.standard_description, 
  m.cnmc, 
  l.warehouse, 
  l.aisle, 
  l.rack, 
  l.bin, 
  (inv.quantity - inv.reserved_quantity) AS available_quantity, 
  m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' 
  AND m.category = 'CHEM' 
  AND m.subcategory = 'LUBR'
ORDER BY available_quantity DESC;`,
      executionTimeMs: 128,
      wasSuccessful: true,
      totalCount: results.length,
      results,
    };
  }

  // --- Fallback: Semantic/Keyword Search across all approved materials ---
  const terms = query.split(' ').filter((t) => t.length > 2);
  const matchedMatIds = mockMaterials
    .filter((m) => {
      const text = `${m.standard_description} ${m.cnmc} ${m.category} ${m.subcategory} ${m.material_type} ${m.spec}`.toLowerCase();
      return terms.some((t) => text.includes(t));
    })
    .map((m) => m.id);

  const results = getInventoryRows(matchedMatIds);

  if (results.length > 0) {
    return {
      query: naturalLanguageQuery,
      interpretation: `Found ${results.length} inventory locations matching query terms across BharatOil master catalog.`,
      generatedSql: `SELECT 
  m.standard_description, 
  m.cnmc, 
  l.warehouse, 
  l.aisle, 
  l.rack, 
  l.bin, 
  (inv.quantity - inv.reserved_quantity) AS available_quantity, 
  m.unit_of_measure 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
JOIN locations l ON l.code = inv.location_code 
WHERE m.status = 'approved' 
  AND (m.standard_description ILIKE '%${terms[0] || ''}%' OR m.cnmc ILIKE '%${terms[0] || ''}%')
ORDER BY available_quantity DESC LIMIT 50;`,
      executionTimeMs: 155,
      wasSuccessful: true,
      totalCount: results.length,
      results,
    };
  }

  // Empty result fallback
  return {
    query: naturalLanguageQuery,
    interpretation: `No approved materials matched the query "${naturalLanguageQuery}" in the BharatOil catalog.`,
    generatedSql: `SELECT m.standard_description, m.cnmc, inv.quantity 
FROM materials m 
JOIN inventory inv ON inv.material_id = m.id 
WHERE m.status = 'approved' 
  AND m.standard_description ILIKE '%${query}%';`,
    executionTimeMs: 98,
    wasSuccessful: true,
    totalCount: 0,
    results: [],
  };
}

export default executeMockQuery;
