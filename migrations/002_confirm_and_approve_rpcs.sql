-- ============================================================
-- Saarthi — Phase 1.2 transactional RPCs
-- ============================================================
-- Plan steps: 1.2.2 (confirm_receipt), 1.2.3 (approve_mapping).
-- Refs: E2, E3, E5, E6, E12, A7, D-6.
--
-- This migration is purely additive: one new nullable column with a
-- partial unique index, and two new functions. Nothing currently
-- running (the Python confirm_receipt in services/receipt_service.py,
-- the /matching/{id}/approve|reject endpoints) calls these yet, so
-- applying this file changes no live behaviour by itself. The backend
-- switch-over (routers/intake.py, routers/matching.py calling these
-- RPCs instead of doing the work in Python; the OCR-as-read-only-draft
-- change) is separate follow-up work, tracked as its own step.
--
-- Both functions do all of their writes in PL/pgSQL, which Postgres
-- always runs as a single transaction: any RAISE EXCEPTION that isn't
-- caught rolls back everything the function did, so there is no need
-- for the manual "undo what we already wrote" logic that
-- receipt_service.py currently has to do from the Python side.
-- ============================================================


-- ------------------------------------------------------------
-- Schema change: a real column for the idempotency key, replacing the
-- ocr_raw_data->>'draft_id' text match in the current Python
-- implementation. The partial unique index lets confirm_receipt below
-- close plan finding E3's remaining gap (two simultaneous requests
-- with the same client_draft_id could both pass a check-then-insert
-- done in application code) by relying on the database to reject the
-- second insert outright, instead of checking-then-inserting.
-- ------------------------------------------------------------
ALTER TABLE public.goods_receipts ADD COLUMN IF NOT EXISTS client_draft_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gr_client_draft_unique
  ON public.goods_receipts (received_by, client_draft_id)
  WHERE client_draft_id IS NOT NULL;


-- ------------------------------------------------------------
-- 1.2.2 (refs E2, E3, E5, E6, A7, D-6) — confirm_receipt.
--
-- Everything OCR review produced — including data for materials that
-- don't exist in the catalog yet — is now submitted in one call at
-- confirm time (this is what makes OCR itself read-only, D-6). For
-- each line the caller says either:
--   * material_id: link to a material that already exists (an
--     auto-linked exact match, or one the operator picked), or
--   * new_material: this line's material doesn't exist yet; create it
--     (as 'pending') as part of this same transaction, retrying the
--     CNMC with a numeric suffix if it collides (mirrors today's
--     _ensure_unique_cnmc, but now genuinely atomic with the insert).
-- A line can also carry candidate_match: if the new material resembles
-- an existing one, a matching_queue row is created for review — same
-- as today's behaviour, just moved from OCR time to confirm time.
--
-- p_payload shape:
-- {
--   "vendor_id": uuid, "receipt_date": "YYYY-MM-DD", "po_number": text|null,
--   "bill_image_path": text|null, "client_draft_id": text|null,
--   "received_by": uuid, "received_by_role": text,
--   "line_items": [{
--     "quantity": number, "unit": text, "unit_price": number,
--     "quality_grade": "A"|"B"|"C"|null, "quality_notes": text|null,
--     "location_code": text, "barcode": text|null, "batch_number": text|null,
--     "expiry_date": "YYYY-MM-DD"|null, "raw_description": text,
--     "match_status": "exact_match"|"near_duplicate"|"new_material"|"uncertain",
--     "material_id": uuid|null,
--     "new_material": null | {
--       "cnmc": text, "category": text, "subcategory": text, "material_type": text,
--       "spec": text|null, "quality_grade": "A"|"B"|"C"|null,
--       "standard_description": text, "short_description": text|null,
--       "technical_specs": object|null, "unit_of_measure": text,
--       "embedding": number[]|null
--     },
--     "candidate_match": null | {
--       "matched_material_id": uuid, "match_type": text,
--       "confidence_score": number, "vector_similarity": number|null,
--       "match_reason": text|null
--     }
--   }]
-- }
--
-- Returns: {"receipt_id", "gr_number", "total_value", "line_items_created", "already_confirmed"}
-- Raises (caught by the caller on error text): 'VALIDATION: <message>' for
-- anything the caller should show the operator as a 422.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_receipt(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_received_by      UUID := (p_payload->>'received_by')::UUID;
  v_client_draft_id   TEXT := NULLIF(p_payload->>'client_draft_id', '');
  v_gr_id             UUID;
  v_gr_number         TEXT;
  v_total_value       NUMERIC(14,2) := 0;
  v_line              JSONB;
  v_line_count        INT := 0;
  v_material_id       UUID;
  v_line_id           UUID;
  v_new_mat           JSONB;
  v_cand              JSONB;
  v_cnmc              TEXT;
  v_suffix            INT;
  v_existing          RECORD;
BEGIN
  IF v_received_by IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: received_by is required';
  END IF;
  IF jsonb_array_length(COALESCE(p_payload->'line_items', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'VALIDATION: at least one line item is required';
  END IF;

  -- Idempotency: a prior successful call with the same client_draft_id
  -- returns the receipt it already created instead of erroring or
  -- creating a second one.
  IF v_client_draft_id IS NOT NULL THEN
    SELECT gr.id, gr.gr_number, gr.total_value,
           (SELECT COUNT(*) FROM gr_line_items WHERE gr_id = gr.id) AS line_count
      INTO v_existing
      FROM goods_receipts gr
      WHERE gr.received_by = v_received_by AND gr.client_draft_id = v_client_draft_id;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'receipt_id', v_existing.id, 'gr_number', v_existing.gr_number,
        'total_value', v_existing.total_value, 'line_items_created', v_existing.line_count,
        'already_confirmed', true
      );
    END IF;
  END IF;

  SELECT COALESCE(SUM((l->>'quantity')::NUMERIC * (l->>'unit_price')::NUMERIC), 0)
    INTO v_total_value
    FROM jsonb_array_elements(p_payload->'line_items') l;

  -- The unique index on (received_by, client_draft_id) is what actually
  -- closes the race: if two requests reach here at once, only one
  -- INSERT succeeds; the other hits unique_violation and falls back to
  -- returning the winner's receipt, same as the pre-check above.
  BEGIN
    INSERT INTO goods_receipts (
      vendor_id, receipt_date, po_number, bill_image_url, received_by,
      status, total_value, client_draft_id
    ) VALUES (
      (p_payload->>'vendor_id')::UUID,
      (p_payload->>'receipt_date')::DATE,
      NULLIF(p_payload->>'po_number', ''),
      NULLIF(p_payload->>'bill_image_path', ''),
      v_received_by,
      'completed',
      v_total_value,
      v_client_draft_id
    )
    RETURNING id, gr_number INTO v_gr_id, v_gr_number;
  EXCEPTION WHEN unique_violation THEN
    SELECT gr.id, gr.gr_number, gr.total_value,
           (SELECT COUNT(*) FROM gr_line_items WHERE gr_id = gr.id) AS line_count
      INTO v_existing
      FROM goods_receipts gr
      WHERE gr.received_by = v_received_by AND gr.client_draft_id = v_client_draft_id;
    RETURN jsonb_build_object(
      'receipt_id', v_existing.id, 'gr_number', v_existing.gr_number,
      'total_value', v_existing.total_value, 'line_items_created', v_existing.line_count,
      'already_confirmed', true
    );
  END;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_payload->'line_items')
  LOOP
    v_material_id := NULLIF(v_line->>'material_id', '')::UUID;
    v_new_mat := v_line->'new_material';
    IF v_new_mat = 'null'::jsonb THEN
      v_new_mat := NULL;
    END IF;

    IF v_material_id IS NULL AND v_new_mat IS NOT NULL THEN
      v_cnmc := v_new_mat->>'cnmc';
      v_suffix := 1;
      LOOP
        BEGIN
          INSERT INTO materials (
            cnmc, status, category, subcategory, material_type, spec, quality_grade,
            standard_description, short_description, technical_specs, unit_of_measure,
            embedding, created_by
          ) VALUES (
            v_cnmc, 'pending',
            COALESCE(NULLIF(v_new_mat->>'category', ''), 'MISC'),
            COALESCE(NULLIF(v_new_mat->>'subcategory', ''), 'GEN'),
            COALESCE(NULLIF(v_new_mat->>'material_type', ''), 'GEN'),
            NULLIF(v_new_mat->>'spec', ''),
            NULLIF(v_new_mat->>'quality_grade', ''),
            COALESCE(NULLIF(v_new_mat->>'standard_description', ''), v_line->>'raw_description'),
            NULLIF(v_new_mat->>'short_description', ''),
            v_new_mat->'technical_specs',
            COALESCE(NULLIF(v_new_mat->>'unit_of_measure', ''), v_line->>'unit'),
            CASE WHEN jsonb_typeof(v_new_mat->'embedding') = 'array'
                 -- Built as a vector text literal ('[0.1,0.2,...]') rather than cast from a
                 -- float8[] array, since the array->vector cast isn't present on every
                 -- pgvector version; the text literal input is always supported.
                 THEN ('[' || (SELECT string_agg(x, ',') FROM jsonb_array_elements_text(v_new_mat->'embedding') x) || ']')::VECTOR(768)
                 ELSE NULL END,
            v_received_by
          )
          RETURNING id INTO v_material_id;
          EXIT;
        EXCEPTION WHEN unique_violation THEN
          v_suffix := v_suffix + 1;
          v_cnmc := (v_new_mat->>'cnmc') || '-' || v_suffix;
          IF v_suffix > 50 THEN
            v_cnmc := (v_new_mat->>'cnmc') || '-' || substr(md5(random()::text), 1, 6);
          END IF;
        END;
      END LOOP;

      INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, new_value)
      VALUES (v_received_by, p_payload->>'received_by_role', 'cnmc_generated', 'materials', v_material_id,
              jsonb_build_object('cnmc', v_cnmc));

      v_cand := v_line->'candidate_match';
      IF v_cand = 'null'::jsonb THEN
        v_cand := NULL;
      END IF;
      IF v_cand IS NOT NULL AND NULLIF(v_cand->>'matched_material_id', '') IS NOT NULL THEN
        INSERT INTO matching_queue (
          new_material_id, matched_material_id, match_type, confidence_score,
          vector_similarity, match_reason, status
        ) VALUES (
          v_material_id,
          (v_cand->>'matched_material_id')::UUID,
          v_cand->>'match_type',
          (v_cand->>'confidence_score')::NUMERIC,
          NULLIF(v_cand->>'vector_similarity', '')::NUMERIC,
          v_cand->>'match_reason',
          'pending'
        )
        ON CONFLICT (new_material_id, matched_material_id) DO NOTHING;
      END IF;
    END IF;

    IF v_material_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION: a line item has neither material_id nor new_material data';
    END IF;

    -- Defense in depth: the backend already validates this, but a
    -- concurrent deprecation between validation and confirm should
    -- still be caught here rather than silently booking stock.
    PERFORM 1 FROM materials WHERE id = v_material_id AND status != 'deprecated';
    IF NOT FOUND THEN
      RAISE EXCEPTION 'VALIDATION: the material for one of the line items no longer exists or has been deprecated';
    END IF;

    INSERT INTO gr_line_items (
      gr_id, material_id, quantity_received, unit_of_measure, unit_price,
      quality_grade, quality_notes, location_code, barcode, batch_number, expiry_date,
      raw_description, match_status
    ) VALUES (
      v_gr_id, v_material_id,
      (v_line->>'quantity')::NUMERIC,
      v_line->>'unit',
      (v_line->>'unit_price')::NUMERIC,
      NULLIF(v_line->>'quality_grade', ''),
      NULLIF(v_line->>'quality_notes', ''),
      v_line->>'location_code',
      NULLIF(v_line->>'barcode', ''),
      NULLIF(v_line->>'batch_number', ''),
      NULLIF(v_line->>'expiry_date', '')::DATE,
      v_line->>'raw_description',
      v_line->>'match_status'
    )
    RETURNING id INTO v_line_id;
    v_line_count := v_line_count + 1;

    INSERT INTO inventory (material_id, location_code, quantity, last_movement_at, last_updated)
    VALUES (v_material_id, v_line->>'location_code', (v_line->>'quantity')::NUMERIC, NOW(), NOW())
    ON CONFLICT (material_id, location_code) DO UPDATE SET
      quantity = inventory.quantity + EXCLUDED.quantity,
      last_movement_at = NOW(),
      last_updated = NOW();

    IF (v_line->>'unit_price')::NUMERIC > 0 THEN
      INSERT INTO price_history (material_id, vendor_id, gr_line_item_id, unit_price, quantity, purchase_date)
      VALUES (
        v_material_id, (p_payload->>'vendor_id')::UUID, v_line_id,
        (v_line->>'unit_price')::NUMERIC, (v_line->>'quantity')::NUMERIC,
        (p_payload->>'receipt_date')::DATE
      );
    END IF;
  END LOOP;

  INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, new_value)
  VALUES (
    v_received_by, p_payload->>'received_by_role', 'receipt_confirmed', 'goods_receipts', v_gr_id,
    jsonb_build_object('gr_number', v_gr_number, 'line_items', v_line_count, 'total_value', v_total_value)
  );

  RETURN jsonb_build_object(
    'receipt_id', v_gr_id, 'gr_number', v_gr_number,
    'total_value', v_total_value, 'line_items_created', v_line_count,
    'already_confirmed', false
  );
END;
$$;


-- ------------------------------------------------------------
-- 1.2.3 (refs E12) — approve_mapping.
--
-- p_action = 'reject': the two materials are different; just close the
-- review (same as today's behaviour).
-- p_action = 'approve': the new (pending) material is confirmed to be
-- the same real-world item as the matched (existing) one — merge its
-- stock into the survivor, repoint its purchase/price history and
-- legacy-code mappings, and deprecate (not delete) the duplicate so
-- history and audit trail stay intact.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_mapping(
  p_match_id UUID,
  p_reviewer_id UUID,
  p_reviewer_role TEXT,
  p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match       RECORD;
  v_new_status  TEXT;
  v_inv         RECORD;
  v_merged_qty  NUMERIC(14,3) := 0;
  v_merged_bins INT := 0;
BEGIN
  IF p_action NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'VALIDATION: action must be approve or reject';
  END IF;

  SELECT id, new_material_id, matched_material_id, status
    INTO v_match
    FROM matching_queue
    WHERE id = p_match_id
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: match % does not exist', p_match_id;
  END IF;
  IF v_match.status != 'pending' THEN
    RAISE EXCEPTION 'ALREADY_REVIEWED: this match was already reviewed (status: %)', v_match.status;
  END IF;

  v_new_status := CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END;

  IF p_action = 'approve' THEN
    -- Merge every inventory bin of the duplicate into the survivor.
    FOR v_inv IN SELECT location_code, quantity FROM inventory WHERE material_id = v_match.new_material_id
    LOOP
      INSERT INTO inventory (material_id, location_code, quantity, last_movement_at, last_updated)
      VALUES (v_match.matched_material_id, v_inv.location_code, v_inv.quantity, NOW(), NOW())
      ON CONFLICT (material_id, location_code) DO UPDATE SET
        quantity = inventory.quantity + EXCLUDED.quantity,
        last_movement_at = NOW(),
        last_updated = NOW();
      v_merged_qty := v_merged_qty + v_inv.quantity;
      v_merged_bins := v_merged_bins + 1;
    END LOOP;
    DELETE FROM inventory WHERE material_id = v_match.new_material_id;

    -- Repoint history so it stays attached to the surviving material.
    UPDATE gr_line_items SET material_id = v_match.matched_material_id
      WHERE material_id = v_match.new_material_id;
    UPDATE price_history SET material_id = v_match.matched_material_id
      WHERE material_id = v_match.new_material_id;
    UPDATE material_code_mappings SET material_id = v_match.matched_material_id
      WHERE material_id = v_match.new_material_id
        AND NOT EXISTS (
          SELECT 1 FROM material_code_mappings mcm2
          WHERE mcm2.material_id = v_match.matched_material_id
            AND mcm2.source_system = material_code_mappings.source_system
            AND mcm2.legacy_code = material_code_mappings.legacy_code
        );
    DELETE FROM material_code_mappings WHERE material_id = v_match.new_material_id;

    -- Deprecate the duplicate rather than delete it, so audit history
    -- and any FK references that couldn't be repointed stay valid.
    UPDATE materials SET
      status = 'deprecated',
      deprecated_at = NOW(),
      deprecated_by = p_reviewer_id,
      deprecation_reason = 'Merged into ' || COALESCE((SELECT cnmc FROM materials WHERE id = v_match.matched_material_id), v_match.matched_material_id::TEXT) || ' via mapping approval'
      WHERE id = v_match.new_material_id;

    INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value)
    VALUES (
      p_reviewer_id, p_reviewer_role, 'materials_merged', 'materials', v_match.new_material_id,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', 'deprecated', 'merged_into', v_match.matched_material_id,
                          'inventory_bins_merged', v_merged_bins, 'quantity_merged', v_merged_qty)
    );
  END IF;

  UPDATE matching_queue SET
    status = v_new_status, reviewed_by = p_reviewer_id, reviewed_at = NOW()
    WHERE id = p_match_id;

  INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value)
  VALUES (
    p_reviewer_id, p_reviewer_role,
    CASE WHEN p_action = 'approve' THEN 'mapping_approved' ELSE 'mapping_rejected' END,
    'matching_queue', p_match_id,
    jsonb_build_object('status', 'pending'), jsonb_build_object('status', v_new_status)
  );

  RETURN jsonb_build_object(
    'status', v_new_status, 'match_id', p_match_id,
    'inventory_bins_merged', v_merged_bins, 'quantity_merged', v_merged_qty
  );
END;
$$;
