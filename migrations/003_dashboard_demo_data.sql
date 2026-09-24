-- ============================================================
-- Saarthi — dashboard demo-data top-up (2026-09-24)
-- ============================================================
-- Purpose: add a handful of rows so every dashboard has something real
-- and non-zero to show, without touching or mutating anything that
-- already exists. This is NOT the Phase 8 "one consistent dataset"
-- (still open — plan Part 8.1) — it's just enough to click through and
-- confirm each screen renders correctly.
--
-- Rows read as ordinary catalog/business entries (no "demo" marker in
-- the data itself); the cleanup block at the bottom references the
-- exact values this script inserts, so it can still find them later.
--
-- What each step is for:
--   1. A new pending material created today       -> Entry Home "New materials today",
--                                                      Engineer/Admin Home "recent materials"
--   2. A second new material, no technical_specs   -> pulls the Admin "data quality score"
--                                                      below 100% (it's real, so with today's
--                                                      data it's usually 100%)
--   3. A new inventory row below its reorder level -> Engineer Home "Low Stock Alerts"
--   4. A goods receipt dated today                 -> Entry Home "Today's receipts"
--   5. A pending match created today               -> Entry Home "Duplicates detected today"
--   6. An auto_resolved match                       -> Duplicate Detection: all 4 statuses
--                                                      (pending/approved/rejected/auto_resolved)
--                                                      now have at least one example
-- ============================================================


-- 1) A new pending material created today, with full technical_specs.
INSERT INTO public.materials (
  cnmc, status, category, subcategory, material_type, spec, quality_grade,
  standard_description, short_description, technical_specs, unit_of_measure, created_by
) VALUES (
  'MECH-FSTNR-BOLT-M10X40-SS316-A', 'pending', 'MECH', 'FSTNR', 'BOLT', 'M10X40-SS316', 'A',
  'Hexagonal Head Bolt M10x40mm Stainless Steel 316 Full Thread', 'Hex Bolt M10x40 SS316',
  '{"thread_size":"M10","length_mm":40,"material":"SS316"}'::jsonb, 'EA',
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
)
ON CONFLICT (cnmc) DO NOTHING;

-- 2) A second new material, deliberately without technical_specs yet.
INSERT INTO public.materials (
  cnmc, status, category, subcategory, material_type,
  standard_description, unit_of_measure, created_by
) VALUES (
  'CONS-MISC-CTIE-300MM-A', 'pending', 'CONS', 'MISC', 'CTIE',
  'Cable Tie Nylon 300mm Black UV Resistant Self-Locking', 'PKT',
  (SELECT id FROM public.profiles WHERE role = 'admin' LIMIT 1)
)
ON CONFLICT (cnmc) DO NOTHING;

-- 3) A new inventory row for an existing approved material, at a location
--    it doesn't already have stock in, with quantity below its reorder
--    level. Purely additive — no existing inventory row is changed.
WITH candidate AS (
  SELECT m.id AS material_id, l.code AS location_code
  FROM public.materials m
  CROSS JOIN public.locations l
  WHERE m.status = 'approved' AND l.is_active
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory i WHERE i.material_id = m.id AND i.location_code = l.code
    )
  LIMIT 1
)
INSERT INTO public.inventory (material_id, location_code, quantity, reorder_level, max_stock)
SELECT material_id, location_code, 2, 10, 100 FROM candidate
ON CONFLICT (material_id, location_code) DO NOTHING;

-- 4) A goods receipt dated today, for an existing approved material at an
--    existing location.
WITH v AS (SELECT id FROM public.vendors WHERE is_active LIMIT 1),
     m AS (SELECT id FROM public.materials WHERE status = 'approved' LIMIT 1),
     l AS (SELECT code FROM public.locations WHERE is_active LIMIT 1),
     gr AS (
       INSERT INTO public.goods_receipts (vendor_id, receipt_date, status, total_value)
       SELECT v.id, CURRENT_DATE, 'completed', 500.00
       FROM v
       RETURNING id
     )
INSERT INTO public.gr_line_items (
  gr_id, material_id, quantity_received, unit_of_measure, unit_price,
  quality_grade, location_code, raw_description, match_status
)
SELECT gr.id, m.id, 50, 'EA', 10.00, 'A', l.code,
       'Stock replenishment - 50 units received', 'exact_match'
FROM gr, m, l;

-- 5) A pending match created today, so Entry Home's "duplicates detected
--    today" (which only counts today's rows) has something too.
INSERT INTO public.matching_queue (
  new_material_id, matched_material_id, match_type, confidence_score, vector_similarity,
  match_reason, status
)
SELECT
  (SELECT id FROM public.materials WHERE cnmc = 'MECH-FSTNR-BOLT-M10X40-SS316-A'),
  (SELECT id FROM public.materials WHERE status = 'approved' AND category = 'MECH' LIMIT 1),
  'exact', 0.95, 0.93,
  'Similar fastener specification with matching thread size and material grade.', 'pending'
WHERE EXISTS (SELECT 1 FROM public.materials WHERE status = 'approved' AND category = 'MECH')
ON CONFLICT (new_material_id, matched_material_id) DO NOTHING;

-- 6) An auto_resolved match, so every matching_queue status has an example.
INSERT INTO public.matching_queue (
  new_material_id, matched_material_id, match_type, confidence_score, vector_similarity,
  match_reason, status
)
SELECT
  (SELECT id FROM public.materials WHERE cnmc = 'CONS-MISC-CTIE-300MM-A'),
  (SELECT id FROM public.materials WHERE status = 'approved' LIMIT 1),
  'exact', 0.99, 0.99,
  'Exact match on description and specification.', 'auto_resolved'
WHERE EXISTS (SELECT 1 FROM public.materials WHERE status = 'approved')
ON CONFLICT (new_material_id, matched_material_id) DO NOTHING;


-- ------------------------------------------------------------
-- Verification — run these after and eyeball the results.
-- ------------------------------------------------------------
SELECT cnmc, status, created_at FROM public.materials
  WHERE cnmc IN ('MECH-FSTNR-BOLT-M10X40-SS316-A', 'CONS-MISC-CTIE-300MM-A');
SELECT * FROM public.v_low_stock_alerts;   -- short list; the new row from step 3 should be in it
SELECT gr_number, receipt_date, status, total_value FROM public.goods_receipts
  WHERE receipt_date = CURRENT_DATE ORDER BY created_at DESC LIMIT 1;
SELECT status, match_type, match_reason FROM public.matching_queue
  WHERE match_reason IN (
    'Similar fastener specification with matching thread size and material grade.',
    'Exact match on description and specification.'
  );


-- ------------------------------------------------------------
-- Cleanup — run this later, once you're done checking dashboards (or
-- whenever Phase 8's real dataset replaces all of today's demo data
-- anyway). Commented out on purpose; uncomment to run.
-- ------------------------------------------------------------
-- DELETE FROM public.matching_queue WHERE match_reason IN (
--   'Similar fastener specification with matching thread size and material grade.',
--   'Exact match on description and specification.'
-- );
-- DELETE FROM public.goods_receipts WHERE id IN (
--   SELECT gr_id FROM public.gr_line_items WHERE raw_description = 'Stock replenishment - 50 units received'
-- );  -- gr_line_items cascade-deletes along with the receipt
-- DELETE FROM public.inventory WHERE material_id IN (
--   SELECT id FROM public.materials WHERE cnmc IN ('MECH-FSTNR-BOLT-M10X40-SS316-A', 'CONS-MISC-CTIE-300MM-A')
-- );
-- DELETE FROM public.materials WHERE cnmc IN ('MECH-FSTNR-BOLT-M10X40-SS316-A', 'CONS-MISC-CTIE-300MM-A');
