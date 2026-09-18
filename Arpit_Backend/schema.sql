-- ============================================================
-- Saarthi — Unified Material Master
-- Supabase / PostgreSQL Schema
-- Project: BharatOil Demo
-- Version: 1.0
-- ============================================================
-- Run this entire file in the Supabase SQL Editor.
-- Order matters — tables are created in dependency order.
-- ============================================================


-- ============================================================
-- STEP 0 — EXTENSIONS
-- ============================================================

-- Enable pgvector for semantic similarity search (embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable uuid-ossp for UUID generation (gen_random_uuid() is built-in in PG14+)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- STEP 1 — PROFILES
-- Extends Supabase Auth users with role + department info
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id              UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT,
  role            TEXT        NOT NULL CHECK (role IN ('entry_operator', 'engineer', 'accounts', 'admin')),
  department      TEXT,
  employee_id     TEXT        UNIQUE,
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles extending Supabase Auth — stores role and department info.';
COMMENT ON COLUMN public.profiles.role IS 'One of: entry_operator, engineer, accounts, admin.';

-- Trigger: auto-create a profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'engineer')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: keep updated_at current on all tables
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- STEP 2 — VENDORS
-- Supplier master data
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vendors (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  code            TEXT        UNIQUE NOT NULL,       -- e.g. VND-001
  contact_person  TEXT,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  gstin           TEXT,                              -- GST Identification Number
  rating          NUMERIC(2,1) CHECK (rating >= 1.0 AND rating <= 5.0),
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.vendors IS 'Supplier / vendor master data for BharatOil.';
COMMENT ON COLUMN public.vendors.code IS 'Unique vendor code, e.g. VND-001.';
COMMENT ON COLUMN public.vendors.rating IS 'Vendor rating from 1.0 to 5.0.';

CREATE TRIGGER vendors_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- STEP 3 — MATERIAL MASTER
-- The canonical unified table — heart of Saarthi
-- ============================================================

CREATE TABLE IF NOT EXISTS public.materials (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Common National Material Code (assigned by AI, immutable after approval)
  cnmc                  TEXT        UNIQUE,           -- e.g. MECH-FSTNR-BOLT-M8X25-SS304-A
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'approved', 'deprecated')),

  -- Classification hierarchy
  category              TEXT        NOT NULL,         -- e.g. MECH
  subcategory           TEXT        NOT NULL,         -- e.g. FSTNR
  material_type         TEXT        NOT NULL,         -- e.g. BOLT
  spec                  TEXT,                         -- e.g. M8X25-SS304
  quality_grade         TEXT        CHECK (quality_grade IN ('A', 'B', 'C')),

  -- Descriptions
  standard_description  TEXT        NOT NULL,         -- AI-standardized canonical description
  short_description     TEXT,                         -- Brief label
  technical_specs       JSONB,                        -- {"thread_size":"M8","length_mm":25,"material":"SS304"}

  -- Unit of measure
  unit_of_measure       TEXT        NOT NULL,         -- EA, KG, MTR, LTR, SET, etc.

  -- Embedding vector for semantic similarity search (768-dim Gemini text-embedding-004)
  embedding             VECTOR(768),

  -- Lifecycle metadata
  created_by            UUID        REFERENCES public.profiles(id),
  approved_by           UUID        REFERENCES public.profiles(id),
  approved_at           TIMESTAMPTZ,
  deprecated_at         TIMESTAMPTZ,
  deprecated_by         UUID        REFERENCES public.profiles(id),
  deprecation_reason    TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.materials IS 'Canonical material master — one row per unique approved material variant.';
COMMENT ON COLUMN public.materials.cnmc IS 'Common National Material Code. Immutable once approved. Format: CAT-SUBCAT-TYPE-SPEC-QUALITY.';
COMMENT ON COLUMN public.materials.embedding IS '768-dim vector from Gemini text-embedding-004, used for pgvector cosine similarity.';
COMMENT ON COLUMN public.materials.technical_specs IS 'JSONB bag of key technical parameters extracted by AI.';

CREATE TRIGGER materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- STEP 4 — LEGACY CODE MAPPINGS
-- Cross-reference between CNMC and dept/legacy codes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.material_code_mappings (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id       UUID        NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  source_system     TEXT        NOT NULL,             -- e.g. 'SAP-MM', 'LEGACY-STORE', 'DEPT-MECH'
  legacy_code       TEXT        NOT NULL,             -- The code used in that source system
  legacy_description TEXT,                            -- Original description from that system
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, legacy_code)
);

COMMENT ON TABLE public.material_code_mappings IS 'Maps legacy/departmental material codes to canonical CNMC materials.';
COMMENT ON COLUMN public.material_code_mappings.source_system IS 'e.g. SAP-MM, LEGACY-STORE, DEPT-MECH, PROC-DEPT.';


-- ============================================================
-- STEP 5 — STOCK LOCATIONS
-- Physical warehouse layout: Warehouse -> Aisle -> Rack -> Bin
-- ============================================================

CREATE TABLE IF NOT EXISTS public.locations (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT    UNIQUE NOT NULL,     -- e.g. WHSE-A-A1-R3-B2
  warehouse   TEXT    NOT NULL,            -- e.g. WHSE-A
  aisle       TEXT,                        -- e.g. A1
  rack        TEXT,                        -- e.g. R3
  bin         TEXT,                        -- e.g. B2
  description TEXT,
  capacity    NUMERIC(12,3),               -- Optional max capacity in base UoM
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.locations IS 'Physical warehouse location hierarchy: Warehouse -> Aisle -> Rack -> Bin.';
COMMENT ON COLUMN public.locations.code IS 'Full location code, e.g. WHSE-A-A1-R3-B2.';


-- ============================================================
-- STEP 6 — INVENTORY
-- Current stock levels per material per location
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id       UUID          NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  location_code     TEXT          NOT NULL REFERENCES public.locations(code) ON DELETE RESTRICT,
  quantity          NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reserved_quantity NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  reorder_level     NUMERIC(12,3),
  max_stock         NUMERIC(12,3),
  last_movement_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_updated      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, location_code)
);

COMMENT ON TABLE public.inventory IS 'Real-time stock levels for each material at each warehouse location.';
COMMENT ON COLUMN public.inventory.reserved_quantity IS 'Quantity reserved for pending orders — not available for new requisitions.';
COMMENT ON COLUMN public.inventory.reorder_level IS 'Stock quantity at or below which a reorder alert is triggered.';
COMMENT ON COLUMN public.inventory.last_movement_at IS 'Timestamp of last physical stock movement — used for aging reports.';


-- ============================================================
-- STEP 7 — GOODS RECEIPTS
-- Header record for each incoming stock entry
-- ============================================================

-- Auto-generate GR numbers: GR-2024-00001
CREATE SEQUENCE IF NOT EXISTS public.gr_number_seq START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_gr_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'GR-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('public.gr_number_seq')::TEXT, 5, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS public.goods_receipts (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_number       TEXT    UNIQUE NOT NULL DEFAULT public.generate_gr_number(),
  vendor_id       UUID    REFERENCES public.vendors(id),
  po_number       TEXT,                       -- Purchase Order reference (external)
  receipt_date    DATE    NOT NULL DEFAULT CURRENT_DATE,
  received_by     UUID    REFERENCES public.profiles(id),
  status          TEXT    NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'processing', 'completed', 'rejected')),
  bill_image_url  TEXT,                       -- Supabase Storage URL of uploaded bill scan
  ocr_raw_data    JSONB,                      -- Raw JSON returned by Gemini Vision OCR
  total_value     NUMERIC(14,2),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.goods_receipts IS 'Header record for each goods receipt (incoming stock delivery).';
COMMENT ON COLUMN public.goods_receipts.gr_number IS 'Unique GR number in format GR-YYYY-NNNNN.';
COMMENT ON COLUMN public.goods_receipts.ocr_raw_data IS 'Raw Gemini Vision OCR output stored for audit/reprocessing.';
COMMENT ON COLUMN public.goods_receipts.bill_image_url IS 'URL of bill image in Supabase Storage bucket: bill-images.';

CREATE TRIGGER goods_receipts_updated_at
  BEFORE UPDATE ON public.goods_receipts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- STEP 8 — GOODS RECEIPT LINE ITEMS
-- One row per material line on a goods receipt
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gr_line_items (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_id               UUID          NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  material_id         UUID          REFERENCES public.materials(id),
  quantity_received   NUMERIC(12,3) NOT NULL CHECK (quantity_received > 0),
  unit_of_measure     TEXT          NOT NULL,
  unit_price          NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
  total_price         NUMERIC(14,2) GENERATED ALWAYS AS (quantity_received * unit_price) STORED,
  quality_grade       TEXT          CHECK (quality_grade IN ('A', 'B', 'C')),
  quality_notes       TEXT,
  location_code       TEXT          REFERENCES public.locations(code),
  barcode             TEXT,                         -- Barcode scanned from item label
  batch_number        TEXT,
  expiry_date         DATE,
  -- OCR-extracted raw description (before matching/standardization)
  raw_description     TEXT,
  -- Match status assigned by AI during intake
  match_status        TEXT          CHECK (match_status IN ('exact_match', 'near_duplicate', 'new_material', 'uncertain')),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.gr_line_items IS 'Individual material line items within a goods receipt.';
COMMENT ON COLUMN public.gr_line_items.total_price IS 'Computed column: quantity_received x unit_price.';
COMMENT ON COLUMN public.gr_line_items.raw_description IS 'OCR-extracted description before AI standardization.';
COMMENT ON COLUMN public.gr_line_items.match_status IS 'AI match result: exact_match | near_duplicate | new_material | uncertain.';


-- ============================================================
-- STEP 9 — PRICE HISTORY
-- Purchase price log per material per vendor per transaction
-- ============================================================

CREATE TABLE IF NOT EXISTS public.price_history (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id       UUID          NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  vendor_id         UUID          REFERENCES public.vendors(id),
  gr_line_item_id   UUID          REFERENCES public.gr_line_items(id),
  unit_price        NUMERIC(12,4) NOT NULL CHECK (unit_price >= 0),
  quantity          NUMERIC(12,3),
  currency          TEXT          NOT NULL DEFAULT 'INR',
  purchase_date     DATE          NOT NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.price_history IS 'Historical purchase prices per material per vendor — used for price intelligence and trend analysis.';


-- ============================================================
-- STEP 10 — AI MATCHING QUEUE
-- Candidate duplicate/equivalent pairs detected by AI
-- ============================================================

CREATE TABLE IF NOT EXISTS public.matching_queue (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  new_material_id       UUID          NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  matched_material_id   UUID          NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  match_type            TEXT          NOT NULL
                                      CHECK (match_type IN ('exact', 'duplicate', 'near_duplicate', 'equivalent', 'different')),
  confidence_score      NUMERIC(5,4)  NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
  match_reason          TEXT,                    -- Human-readable reason from Gemini
  ai_recommendation     TEXT,                    -- Gemini's recommended action
  vector_similarity     NUMERIC(5,4),            -- Raw cosine similarity from pgvector search
  status                TEXT          NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'approved', 'rejected', 'auto_resolved')),
  reviewed_by           UUID          REFERENCES public.profiles(id),
  reviewed_at           TIMESTAMPTZ,
  review_notes          TEXT,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (new_material_id, matched_material_id)
);

COMMENT ON TABLE public.matching_queue IS 'AI-detected duplicate/equivalent material pairs awaiting human review.';
COMMENT ON COLUMN public.matching_queue.confidence_score IS 'Gemini confidence score: 0.0 (no match) to 1.0 (exact match).';
COMMENT ON COLUMN public.matching_queue.vector_similarity IS 'Raw cosine similarity score from pgvector (1 - cosine distance).';
COMMENT ON COLUMN public.matching_queue.status IS 'pending=review needed | approved=mapping confirmed | rejected=new material | auto_resolved=high-confidence auto-merge.';


-- ============================================================
-- STEP 11 — AUDIT LOG
-- Immutable log of every significant action in the system
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID        REFERENCES public.profiles(id),
  actor_role  TEXT,
  action      TEXT        NOT NULL,             -- e.g. MATERIAL_APPROVED, GR_CONFIRMED, MAPPING_REJECTED
  entity_type TEXT        NOT NULL,             -- e.g. material, goods_receipt, matching_queue, inventory
  entity_id   UUID        NOT NULL,
  old_value   JSONB,                            -- Snapshot of record before change
  new_value   JSONB,                            -- Snapshot of record after change
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_log IS 'Immutable audit trail — every significant action logged with before/after values.';
COMMENT ON COLUMN public.audit_log.action IS 'Action codes: MATERIAL_APPROVED, MATERIAL_DEPRECATED, GR_CONFIRMED, MAPPING_APPROVED, MAPPING_REJECTED, CNMC_GENERATED, INVENTORY_UPDATED.';
COMMENT ON COLUMN public.audit_log.old_value IS 'JSONB snapshot of the entity before the change.';
COMMENT ON COLUMN public.audit_log.new_value IS 'JSONB snapshot of the entity after the change.';


-- ============================================================
-- STEP 12 — NL QUERY LOG
-- Tracks every natural-language -> SQL query run by engineers
-- ============================================================

CREATE TABLE IF NOT EXISTS public.nl_query_log (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID    REFERENCES public.profiles(id),
  natural_language_query TEXT    NOT NULL,
  generated_sql          TEXT,
  sql_explanation        TEXT,                  -- Gemini's explanation of what the SQL does
  query_result_count     INTEGER,
  execution_time_ms      INTEGER,
  was_successful         BOOLEAN NOT NULL DEFAULT FALSE,
  error_message          TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.nl_query_log IS 'Log of all natural-language queries converted to SQL by the NL->SQL service.';


-- ============================================================
-- STEP 13 — INDEXES
-- ============================================================

-- Vector similarity search (ivfflat for approximate NN — fast at scale)
-- lists=100 is good for ~100k materials; increase to 200 for >1M rows
CREATE INDEX IF NOT EXISTS idx_materials_embedding
  ON public.materials USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Material lookups
CREATE INDEX IF NOT EXISTS idx_materials_cnmc          ON public.materials (cnmc);
CREATE INDEX IF NOT EXISTS idx_materials_status        ON public.materials (status);
CREATE INDEX IF NOT EXISTS idx_materials_category      ON public.materials (category, subcategory);
CREATE INDEX IF NOT EXISTS idx_materials_type          ON public.materials (material_type);
CREATE INDEX IF NOT EXISTS idx_materials_created_at    ON public.materials (created_at DESC);

-- Full-text search on standard description
CREATE INDEX IF NOT EXISTS idx_materials_description_fts
  ON public.materials USING gin (to_tsvector('english', standard_description));

-- Inventory
CREATE INDEX IF NOT EXISTS idx_inventory_material      ON public.inventory (material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_location      ON public.inventory (location_code);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock
  ON public.inventory (material_id)
  WHERE quantity <= reorder_level;

-- Goods receipts
CREATE INDEX IF NOT EXISTS idx_gr_vendor               ON public.goods_receipts (vendor_id);
CREATE INDEX IF NOT EXISTS idx_gr_status               ON public.goods_receipts (status);
CREATE INDEX IF NOT EXISTS idx_gr_receipt_date         ON public.goods_receipts (receipt_date DESC);
CREATE INDEX IF NOT EXISTS idx_gr_received_by          ON public.goods_receipts (received_by);

-- GR line items
CREATE INDEX IF NOT EXISTS idx_gr_items_gr             ON public.gr_line_items (gr_id);
CREATE INDEX IF NOT EXISTS idx_gr_items_material       ON public.gr_line_items (material_id);

-- Price history
CREATE INDEX IF NOT EXISTS idx_price_material_date     ON public.price_history (material_id, purchase_date DESC);
CREATE INDEX IF NOT EXISTS idx_price_vendor            ON public.price_history (vendor_id);

-- Legacy code mappings
CREATE INDEX IF NOT EXISTS idx_mappings_material       ON public.material_code_mappings (material_id);
CREATE INDEX IF NOT EXISTS idx_mappings_source         ON public.material_code_mappings (source_system);

-- Matching queue
CREATE INDEX IF NOT EXISTS idx_matching_status         ON public.matching_queue (status);
CREATE INDEX IF NOT EXISTS idx_matching_new_mat        ON public.matching_queue (new_material_id);
CREATE INDEX IF NOT EXISTS idx_matching_matched_mat    ON public.matching_queue (matched_material_id);
CREATE INDEX IF NOT EXISTS idx_matching_confidence     ON public.matching_queue (confidence_score DESC);

-- Audit log
CREATE INDEX IF NOT EXISTS idx_audit_entity            ON public.audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor             ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action            ON public.audit_log (action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at        ON public.audit_log (created_at DESC);

-- NL query log
CREATE INDEX IF NOT EXISTS idx_nlquery_user            ON public.nl_query_log (user_id, created_at DESC);


-- ============================================================
-- STEP 14 — ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_code_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gr_line_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_queue         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nl_query_log           ENABLE ROW LEVEL SECURITY;

-- Helper: get current user role (used in RLS policies)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- -------- PROFILES --------
CREATE POLICY "profiles_select_own"        ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_admin"      ON public.profiles FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "profiles_update_own"        ON public.profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_update_admin"      ON public.profiles FOR UPDATE USING (public.get_my_role() = 'admin');
CREATE POLICY "profiles_insert_self"       ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());

-- -------- VENDORS --------
CREATE POLICY "vendors_select_all"         ON public.vendors FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "vendors_insert_admin_accts" ON public.vendors FOR INSERT WITH CHECK (public.get_my_role() IN ('admin', 'accounts'));
CREATE POLICY "vendors_update_admin_accts" ON public.vendors FOR UPDATE USING (public.get_my_role() IN ('admin', 'accounts'));

-- -------- MATERIALS --------
-- All authenticated users can view approved materials; admins and entry operators see all
CREATE POLICY "materials_select_all"       ON public.materials FOR SELECT
  USING (auth.uid() IS NOT NULL AND (status = 'approved' OR public.get_my_role() IN ('admin', 'entry_operator')));
CREATE POLICY "materials_insert_entry_adm" ON public.materials FOR INSERT
  WITH CHECK (public.get_my_role() IN ('entry_operator', 'admin'));
CREATE POLICY "materials_update_admin"     ON public.materials FOR UPDATE USING (public.get_my_role() = 'admin');
CREATE POLICY "materials_update_entry_own" ON public.materials FOR UPDATE
  USING (public.get_my_role() = 'entry_operator' AND created_by = auth.uid() AND status = 'pending');

-- -------- MATERIAL CODE MAPPINGS --------
CREATE POLICY "mappings_select_all"        ON public.material_code_mappings FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mappings_insert_entry_adm"  ON public.material_code_mappings FOR INSERT
  WITH CHECK (public.get_my_role() IN ('entry_operator', 'admin'));

-- -------- LOCATIONS --------
CREATE POLICY "locations_select_all"       ON public.locations FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "locations_insert_admin"     ON public.locations FOR INSERT WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "locations_update_admin"     ON public.locations FOR UPDATE USING (public.get_my_role() = 'admin');

-- -------- INVENTORY --------
CREATE POLICY "inventory_select_all"       ON public.inventory FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "inventory_insert_entry_adm" ON public.inventory FOR INSERT
  WITH CHECK (public.get_my_role() IN ('entry_operator', 'admin'));
CREATE POLICY "inventory_update_entry_adm" ON public.inventory FOR UPDATE
  USING (public.get_my_role() IN ('entry_operator', 'admin'));

-- -------- GOODS RECEIPTS --------
CREATE POLICY "gr_select_all"              ON public.goods_receipts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "gr_insert_entry"            ON public.goods_receipts FOR INSERT
  WITH CHECK (public.get_my_role() IN ('entry_operator', 'admin'));
CREATE POLICY "gr_update_entry_own"        ON public.goods_receipts FOR UPDATE
  USING (public.get_my_role() IN ('entry_operator', 'admin') AND (received_by = auth.uid() OR public.get_my_role() = 'admin'));

-- -------- GR LINE ITEMS --------
CREATE POLICY "gr_items_select_all"        ON public.gr_line_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "gr_items_insert_entry_adm"  ON public.gr_line_items FOR INSERT
  WITH CHECK (public.get_my_role() IN ('entry_operator', 'admin'));

-- -------- PRICE HISTORY --------
CREATE POLICY "price_history_select_all"   ON public.price_history FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "price_history_insert"       ON public.price_history FOR INSERT
  WITH CHECK (public.get_my_role() IN ('entry_operator', 'admin'));

-- -------- MATCHING QUEUE --------
CREATE POLICY "matching_select_entry_adm"  ON public.matching_queue FOR SELECT
  USING (public.get_my_role() IN ('entry_operator', 'admin'));
CREATE POLICY "matching_insert_admin"      ON public.matching_queue FOR INSERT
  WITH CHECK (public.get_my_role() = 'admin');
CREATE POLICY "matching_update_entry_adm"  ON public.matching_queue FOR UPDATE
  USING (public.get_my_role() IN ('entry_operator', 'admin'));

-- -------- AUDIT LOG --------
-- Only admins can read; writes are done by backend via service_role key
CREATE POLICY "audit_select_admin"         ON public.audit_log FOR SELECT USING (public.get_my_role() = 'admin');

-- -------- NL QUERY LOG --------
CREATE POLICY "nlquery_select_own"         ON public.nl_query_log FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "nlquery_select_admin"       ON public.nl_query_log FOR SELECT USING (public.get_my_role() = 'admin');
CREATE POLICY "nlquery_insert_auth"        ON public.nl_query_log FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- STEP 14b — GRANT PERMISSIONS TO SUPABASE ROLES
-- ============================================================
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;



-- ============================================================
-- STEP 15 — VIEWS
-- Pre-built views for common dashboard queries
-- ============================================================

-- Full inventory with material and location details
CREATE OR REPLACE VIEW public.v_inventory_full AS
SELECT
  i.id,
  i.material_id,
  m.cnmc,
  m.standard_description,
  m.category,
  m.subcategory,
  m.material_type,
  m.unit_of_measure,
  i.location_code,
  l.warehouse,
  l.aisle,
  l.rack,
  l.bin,
  i.quantity,
  i.reserved_quantity,
  (i.quantity - i.reserved_quantity)  AS available_quantity,
  i.reorder_level,
  i.max_stock,
  CASE
    WHEN i.quantity = 0                                          THEN 'empty'
    WHEN i.reorder_level IS NOT NULL AND i.quantity <= i.reorder_level THEN 'critical'
    WHEN i.max_stock IS NOT NULL AND i.quantity >= i.max_stock * 0.9   THEN 'overstock'
    ELSE 'normal'
  END AS stock_status,
  i.last_movement_at
FROM public.inventory i
JOIN public.materials m ON m.id = i.material_id
JOIN public.locations l ON l.code = i.location_code
WHERE m.status = 'approved';

COMMENT ON VIEW public.v_inventory_full IS 'Full inventory view joining materials and locations — used by NL->SQL queries and engineer dashboard.';

-- Price comparison per material per vendor
CREATE OR REPLACE VIEW public.v_price_comparison AS
SELECT
  ph.material_id,
  m.cnmc,
  m.standard_description,
  ph.vendor_id,
  v.name                             AS vendor_name,
  v.code                             AS vendor_code,
  v.rating                           AS vendor_rating,
  COUNT(*)                           AS purchase_count,
  MIN(ph.unit_price)                 AS min_price,
  MAX(ph.unit_price)                 AS max_price,
  ROUND(AVG(ph.unit_price), 4)       AS avg_price,
  MAX(ph.purchase_date)              AS last_purchase_date,
  (
    SELECT unit_price
    FROM public.price_history ph2
    WHERE ph2.material_id = ph.material_id AND ph2.vendor_id = ph.vendor_id
    ORDER BY purchase_date DESC
    LIMIT 1
  )                                  AS last_price
FROM public.price_history ph
JOIN public.materials m ON m.id = ph.material_id
JOIN public.vendors   v ON v.id = ph.vendor_id
GROUP BY ph.material_id, m.cnmc, m.standard_description, ph.vendor_id, v.name, v.code, v.rating;

COMMENT ON VIEW public.v_price_comparison IS 'Aggregated price stats per material per vendor — accounts dashboard price intelligence.';

-- Low stock alerts
CREATE OR REPLACE VIEW public.v_low_stock_alerts AS
SELECT
  i.material_id,
  m.cnmc,
  m.standard_description,
  m.category,
  m.unit_of_measure,
  SUM(i.quantity)    AS total_quantity,
  i.reorder_level,
  CASE
    WHEN SUM(i.quantity) = 0 THEN 'out_of_stock'
    ELSE 'low_stock'
  END AS alert_type
FROM public.inventory i
JOIN public.materials m ON m.id = i.material_id
WHERE m.status = 'approved'
  AND i.reorder_level IS NOT NULL
  AND i.quantity <= i.reorder_level
GROUP BY i.material_id, m.cnmc, m.standard_description, m.category, m.unit_of_measure, i.reorder_level;

COMMENT ON VIEW public.v_low_stock_alerts IS 'Materials at or below reorder level — used for dashboard alerts.';

-- Matching queue with full material details
CREATE OR REPLACE VIEW public.v_matching_queue_detailed AS
SELECT
  mq.id,
  mq.status,
  mq.match_type,
  mq.confidence_score,
  mq.vector_similarity,
  mq.match_reason,
  mq.ai_recommendation,
  nm.id                AS new_material_id,
  nm.cnmc              AS new_cnmc,
  nm.standard_description AS new_description,
  nm.category          AS new_category,
  nm.subcategory       AS new_subcategory,
  nm.technical_specs   AS new_specs,
  nm.quality_grade     AS new_quality,
  em.id                AS matched_material_id,
  em.cnmc              AS matched_cnmc,
  em.standard_description AS matched_description,
  em.category          AS matched_category,
  em.subcategory       AS matched_subcategory,
  em.technical_specs   AS matched_specs,
  em.quality_grade     AS matched_quality,
  em.status            AS matched_status,
  mq.reviewed_by,
  p.full_name          AS reviewer_name,
  mq.reviewed_at,
  mq.review_notes,
  mq.created_at
FROM public.matching_queue mq
JOIN public.materials nm ON nm.id = mq.new_material_id
JOIN public.materials em ON em.id = mq.matched_material_id
LEFT JOIN public.profiles p ON p.id = mq.reviewed_by;

COMMENT ON VIEW public.v_matching_queue_detailed IS 'Matching queue with full material details — used in entry operator pending approvals screen.';


-- ============================================================
-- STEP 16 — HELPER FUNCTIONS (RPC endpoints)
-- ============================================================

-- Semantic search: top-N materials by cosine similarity to a query embedding
CREATE OR REPLACE FUNCTION public.search_materials_by_embedding(
  query_embedding  VECTOR(768),
  match_threshold  FLOAT   DEFAULT 0.70,
  match_count      INT     DEFAULT 10,
  filter_status    TEXT    DEFAULT 'approved'
)
RETURNS TABLE (
  id                   UUID,
  cnmc                 TEXT,
  standard_description TEXT,
  category             TEXT,
  subcategory          TEXT,
  material_type        TEXT,
  quality_grade        TEXT,
  unit_of_measure      TEXT,
  technical_specs      JSONB,
  similarity           FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    m.id,
    m.cnmc,
    m.standard_description,
    m.category,
    m.subcategory,
    m.material_type,
    m.quality_grade,
    m.unit_of_measure,
    m.technical_specs,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.materials m
  WHERE
    (filter_status IS NULL OR m.status = filter_status)
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> query_embedding) >= match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
$$;

COMMENT ON FUNCTION public.search_materials_by_embedding IS 'pgvector cosine similarity search — returns top matching materials for a given embedding vector. Called via Supabase RPC.';

-- Inventory value by category (for accounts dashboard)
CREATE OR REPLACE FUNCTION public.get_inventory_value_by_category()
RETURNS TABLE (
  category    TEXT,
  total_value NUMERIC,
  item_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.category,
    ROUND(SUM(i.quantity * COALESCE(ph.avg_price, 0)), 2) AS total_value,
    COUNT(DISTINCT m.id)                                   AS item_count
  FROM public.inventory i
  JOIN public.materials m ON m.id = i.material_id
  LEFT JOIN (
    SELECT material_id, AVG(unit_price) AS avg_price
    FROM public.price_history
    GROUP BY material_id
  ) ph ON ph.material_id = m.id
  WHERE m.status = 'approved'
  GROUP BY m.category
  ORDER BY total_value DESC NULLS LAST;
$$;

-- Admin dashboard stats (single RPC call)
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total_materials',      (SELECT COUNT(*) FROM public.materials),
    'approved_materials',   (SELECT COUNT(*) FROM public.materials WHERE status = 'approved'),
    'pending_materials',    (SELECT COUNT(*) FROM public.materials WHERE status = 'pending'),
    'deprecated_materials', (SELECT COUNT(*) FROM public.materials WHERE status = 'deprecated'),
    'pending_matches',      (SELECT COUNT(*) FROM public.matching_queue WHERE status = 'pending'),
    'total_vendors',        (SELECT COUNT(*) FROM public.vendors WHERE is_active = TRUE),
    'total_receipts',       (SELECT COUNT(*) FROM public.goods_receipts),
    'receipts_today',       (SELECT COUNT(*) FROM public.goods_receipts WHERE receipt_date = CURRENT_DATE)
  );
$$;


-- ============================================================
-- STEP 17 — SUPABASE STORAGE BUCKET
-- Private bucket for uploaded bill images (OCR source files)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bill-images',
  'bill-images',
  FALSE,
  10485760,   -- 10 MB max file size
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Only entry operators and admins can upload
CREATE POLICY "bill_images_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bill-images' AND public.get_my_role() IN ('entry_operator', 'admin'));

-- All authenticated users can read (download with signed URL)
CREATE POLICY "bill_images_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bill-images' AND auth.uid() IS NOT NULL);


-- ============================================================
-- STEP 18 — SEED DATA (BharatOil Demo)
-- ============================================================

-- ---- 18.1 Vendors ----

INSERT INTO public.vendors (name, code, contact_person, phone, email, gstin, rating) VALUES
  ('FastFix Industries',  'VND-001', 'Ramesh Kumar',  '9876543210', 'ramesh@fastfix.in',    '27AABCF1234A1Z5', 4.5),
  ('PipePro Supplies',    'VND-002', 'Suresh Patel',  '9876543211', 'suresh@pipepro.in',    '24AABCP5678B2Z3', 4.2),
  ('ValveTech India',     'VND-003', 'Anil Sharma',   '9876543212', 'anil@valvetech.in',    '07AABCV9012C3Z1', 4.7),
  ('ElectroCore Ltd',     'VND-004', 'Priya Nair',    '9876543213', 'priya@electrocore.in', '32AABCE3456D4Z8', 4.3),
  ('LubriMax India',      'VND-005', 'Deepak Joshi',  '9876543214', 'deepak@lubrimax.in',   '08AABCL7890E5Z6', 4.6),
  ('SafeGear Pvt Ltd',    'VND-006', 'Kavita Singh',  '9876543215', 'kavita@safegear.in',   '06AABCS2345F6Z4', 4.1),
  ('WeldPro Supplies',    'VND-007', 'Mohan Rao',     '9876543216', 'mohan@weldpro.in',     '36AABCW6789G7Z2', 4.4),
  ('SteelCraft India',    'VND-008', 'Neha Verma',    '9876543217', 'neha@steelcraft.in',   '27AABCS1234H8Z0', 4.0),
  ('ChemiFluid Ltd',      'VND-009', 'Rajan Iyer',    '9876543218', 'rajan@chemifluid.in',  '33AABCC5678I9Z9', 4.5),
  ('ToolMart India',      'VND-010', 'Sunita Gupta',  '9876543219', 'sunita@toolmart.in',   '29AABCT9012J0Z7', 4.2)
ON CONFLICT (code) DO NOTHING;

-- ---- 18.2 Locations ----
-- 3 Warehouses: WHSE-A (Mechanical), WHSE-B (Electrical), WHSE-C (Chemical & Consumables)

INSERT INTO public.locations (code, warehouse, aisle, rack, bin, description) VALUES
  ('WHSE-A-A1-R1-B1', 'WHSE-A', 'A1', 'R1', 'B1', 'Fasteners - Bolts small'),
  ('WHSE-A-A1-R1-B2', 'WHSE-A', 'A1', 'R1', 'B2', 'Fasteners - Bolts medium'),
  ('WHSE-A-A1-R1-B3', 'WHSE-A', 'A1', 'R1', 'B3', 'Fasteners - Bolts large'),
  ('WHSE-A-A1-R2-B1', 'WHSE-A', 'A1', 'R2', 'B1', 'Fasteners - Nuts'),
  ('WHSE-A-A1-R2-B2', 'WHSE-A', 'A1', 'R2', 'B2', 'Fasteners - Washers'),
  ('WHSE-A-A1-R2-B3', 'WHSE-A', 'A1', 'R2', 'B3', 'Fasteners - Screws'),
  ('WHSE-A-A1-R3-B1', 'WHSE-A', 'A1', 'R3', 'B1', 'Fasteners - Anchor bolts'),
  ('WHSE-A-A2-R1-B1', 'WHSE-A', 'A2', 'R1', 'B1', 'Pipes - SS small bore'),
  ('WHSE-A-A2-R1-B2', 'WHSE-A', 'A2', 'R1', 'B2', 'Pipes - SS large bore'),
  ('WHSE-A-A2-R2-B1', 'WHSE-A', 'A2', 'R2', 'B1', 'Pipe fittings - Elbows'),
  ('WHSE-A-A2-R2-B2', 'WHSE-A', 'A2', 'R2', 'B2', 'Pipe fittings - Flanges'),
  ('WHSE-A-A2-R3-B1', 'WHSE-A', 'A2', 'R3', 'B1', 'Pipe fittings - Reducers'),
  ('WHSE-A-A3-R1-B1', 'WHSE-A', 'A3', 'R1', 'B1', 'Valves - Gate valves'),
  ('WHSE-A-A3-R1-B2', 'WHSE-A', 'A3', 'R1', 'B2', 'Valves - Ball valves'),
  ('WHSE-A-A3-R2-B1', 'WHSE-A', 'A3', 'R2', 'B1', 'Valves - Check valves'),
  ('WHSE-A-A3-R2-B2', 'WHSE-A', 'A3', 'R2', 'B2', 'Valves - Control valves'),
  ('WHSE-B-B1-R1-B1', 'WHSE-B', 'B1', 'R1', 'B1', 'Cables - LT power cables'),
  ('WHSE-B-B1-R1-B2', 'WHSE-B', 'B1', 'R1', 'B2', 'Cables - Control cables'),
  ('WHSE-B-B1-R2-B1', 'WHSE-B', 'B1', 'R2', 'B1', 'Cables - Instrument cables'),
  ('WHSE-B-B1-R2-B2', 'WHSE-B', 'B1', 'R2', 'B2', 'Cables - Armoured cables'),
  ('WHSE-B-B2-R1-B1', 'WHSE-B', 'B2', 'R1', 'B1', 'Motors - Small (up to 5HP)'),
  ('WHSE-B-B2-R1-B2', 'WHSE-B', 'B2', 'R1', 'B2', 'Motors - Medium (5-50HP)'),
  ('WHSE-B-B2-R2-B1', 'WHSE-B', 'B2', 'R2', 'B1', 'Panels - MCC panels'),
  ('WHSE-B-B3-R1-B1', 'WHSE-B', 'B3', 'R1', 'B1', 'Instruments - Pressure gauges'),
  ('WHSE-B-B3-R1-B2', 'WHSE-B', 'B3', 'R1', 'B2', 'Instruments - Temperature sensors'),
  ('WHSE-C-C1-R1-B1', 'WHSE-C', 'C1', 'R1', 'B1', 'Lubricants - Engine oils'),
  ('WHSE-C-C1-R1-B2', 'WHSE-C', 'C1', 'R1', 'B2', 'Lubricants - Gear oils'),
  ('WHSE-C-C1-R2-B1', 'WHSE-C', 'C1', 'R2', 'B1', 'Lubricants - Greases'),
  ('WHSE-C-C2-R1-B1', 'WHSE-C', 'C2', 'R1', 'B1', 'PPE - Safety helmets'),
  ('WHSE-C-C2-R1-B2', 'WHSE-C', 'C2', 'R1', 'B2', 'PPE - Safety shoes'),
  ('WHSE-C-C2-R2-B1', 'WHSE-C', 'C2', 'R2', 'B1', 'PPE - Safety gloves'),
  ('WHSE-C-C2-R2-B2', 'WHSE-C', 'C2', 'R2', 'B2', 'PPE - Safety harness'),
  ('WHSE-C-C3-R1-B1', 'WHSE-C', 'C3', 'R1', 'B1', 'Welding - Electrodes'),
  ('WHSE-C-C3-R1-B2', 'WHSE-C', 'C3', 'R1', 'B2', 'Welding - Filler wire'),
  ('WHSE-C-C3-R2-B1', 'WHSE-C', 'C3', 'R2', 'B1', 'Tools - Hand tools general')
ON CONFLICT (code) DO NOTHING;

-- ---- 18.3 Materials (with intentional duplicates for AI matching demo) ----
-- NOTE: The embedding column must be populated by the backend seed script after insert.

INSERT INTO public.materials
  (cnmc, status, category, subcategory, material_type, spec, quality_grade,
   standard_description, short_description, technical_specs, unit_of_measure)
VALUES

-- MECHANICAL — FASTENERS
('MECH-FSTNR-BOLT-M8X25-SS304-A', 'approved', 'MECH', 'FSTNR', 'BOLT', 'M8X25-SS304', 'A',
 'Hexagonal Head Bolt M8x25mm Stainless Steel Grade 304 Full Thread ISO 4014',
 'Hex Bolt M8x25 SS304',
 '{"thread_size":"M8","length_mm":25,"material":"SS304","head_type":"hexagonal","thread":"full","standard":"ISO 4014"}',
 'EA'),

-- INTENTIONAL DUPLICATE — different dept description, same material (AI should flag this)
('MECH-FSTNR-BOLT-M8X25-SS304-B', 'pending', 'MECH', 'FSTNR', 'BOLT', 'M8X25-SS304', 'B',
 'SS Hexagonal Bolt 8mm Diameter 25mm Length Grade 304 Stainless',
 'S.S Hex Bolt 8x25',
 '{"thread_size":"M8","length_mm":25,"material":"SS304","head_type":"hex","thread":"full"}',
 'EA'),

('MECH-FSTNR-NUT-M8-SS304-A', 'approved', 'MECH', 'FSTNR', 'NUT', 'M8-SS304', 'A',
 'Hexagonal Nut M8 Stainless Steel Grade 304 ISO 4032',
 'Hex Nut M8 SS304',
 '{"thread_size":"M8","material":"SS304","type":"hexagonal","standard":"ISO 4032"}',
 'EA'),

('MECH-FSTNR-WSHR-M8-SS304-A', 'approved', 'MECH', 'FSTNR', 'WSHR', 'M8-SS304', 'A',
 'Plain Washer M8 Stainless Steel Grade 304 ISO 7089',
 'Plain Washer M8 SS304',
 '{"bore_mm":8,"material":"SS304","type":"plain","standard":"ISO 7089"}',
 'EA'),

('MECH-FSTNR-STUD-M16X50-B7-A', 'approved', 'MECH', 'FSTNR', 'STUD', 'M16X50-B7', 'A',
 'Stud Bolt M16x50mm ASTM A193 Grade B7 with 2H Heavy Hex Nuts',
 'Stud Bolt M16x50 A193-B7',
 '{"thread_size":"M16","length_mm":50,"material":"ASTM A193-B7","type":"stud_bolt","nut_grade":"2H"}',
 'SET'),

-- MECHANICAL — PIPES
('MECH-PIPE-PIPE-2INSS-SCH40-A', 'approved', 'MECH', 'PIPE', 'PIPE', '2IN-SS304-S40', 'A',
 'Seamless Stainless Steel Pipe 2 Inch NB Schedule 40 ASTM A312 Grade TP304',
 'SS Pipe 2" SCH40 TP304',
 '{"nominal_bore_inch":2,"schedule":"SCH40","material":"SS304","type":"seamless","standard":"ASTM A312 TP304"}',
 'MTR'),

('MECH-PIPE-ELBO-2IN90-SS304-A', 'approved', 'MECH', 'PIPE', 'ELBO', '2IN-90DEG-SS304', 'A',
 '90 Degree Elbow 2 Inch NB Stainless Steel 304 Schedule 40 Butt Weld ASME B16.9',
 'Elbow 2" 90Deg SS304',
 '{"nominal_bore_inch":2,"angle_deg":90,"material":"SS304","schedule":"SCH40","type":"butt_weld","standard":"ASME B16.9"}',
 'EA'),

('MECH-PIPE-FLAN-2IN150-SS304-A', 'approved', 'MECH', 'PIPE', 'FLAN', '2IN-PN150-SS304', 'A',
 'Weld Neck Flange 2 Inch ANSI 150 Stainless Steel 304 ASME B16.5',
 'WN Flange 2" 150# SS304',
 '{"nominal_bore_inch":2,"rating":"ANSI 150","material":"SS304","type":"weld_neck","standard":"ASME B16.5"}',
 'EA'),

-- MECHANICAL — VALVES
('MECH-VALVE-GATE-2INPN16-CS-A', 'approved', 'MECH', 'VALVE', 'GATE', '2IN-PN16-CS', 'A',
 'Gate Valve 2 Inch PN16 Carbon Steel Flanged End ASME B16.5',
 'Gate Valve 2" PN16 CS',
 '{"nominal_bore_inch":2,"pressure_rating":"PN16","material":"carbon_steel","end":"flanged","standard":"ASME B16.5"}',
 'EA'),

-- INTENTIONAL NEAR-DUPLICATE — different rating nomenclature, same valve (AI should flag this)
(NULL, 'pending', 'MECH', 'VALVE', 'GATE', '2IN-CL150-CS', 'A',
 '2 Inch Gate Valve Class 150 Carbon Steel Flange Ends',
 '2'' Gate Valve CL150 CS',
 '{"nominal_bore_inch":2,"pressure_rating":"Class 150","material":"carbon_steel","end":"flanged"}',
 'EA'),

('MECH-VALVE-BALL-1INPN40-SS316-A', 'approved', 'MECH', 'VALVE', 'BALL', '1IN-PN40-SS316', 'A',
 'Ball Valve 1 Inch PN40 Stainless Steel 316 Full Bore Screwed End',
 'Ball Valve 1" PN40 SS316',
 '{"nominal_bore_inch":1,"pressure_rating":"PN40","material":"SS316","bore":"full","end":"screwed"}',
 'EA'),

-- MECHANICAL — SEALS
('MECH-SEAL-GASK-2INRF-GRAP-A', 'approved', 'MECH', 'SEAL', 'GASK', '2IN-RF-GRAP', 'A',
 'Spiral Wound Gasket 2 Inch ANSI 150 Raised Face Graphite Filler SS316 Winding',
 'SWG 2" ANSI 150 RF Graphite',
 '{"nominal_bore_inch":2,"rating":"ANSI 150","face":"raised","filler":"graphite","winding":"SS316","type":"spiral_wound"}',
 'EA'),

-- MECHANICAL — BEARINGS
('MECH-BEAR-BEAR-6205-2RS-A', 'approved', 'MECH', 'BEAR', 'BEAR', '6205-2RS-SKF', 'A',
 'Deep Groove Ball Bearing 6205-2RS SKF 25mm Bore 52mm OD 15mm Width Sealed Both Sides',
 'Ball Bearing 6205-2RS SKF',
 '{"designation":"6205-2RS","brand":"SKF","bore_mm":25,"od_mm":52,"width_mm":15,"sealed":"both_sides","type":"deep_groove_ball"}',
 'EA'),

-- ELECTRICAL — CABLES
('ELEC-CABLE-CABLE-3CX4SQ-XLPE-A', 'approved', 'ELEC', 'CABLE', 'CABLE', '3CX4MM-XLPE', 'A',
 'Aluminium Armoured Cable 3 Core 4 Sqmm XLPE Insulated PVC Sheathed 1.1kV',
 'AL Cable 3Cx4Sqmm XLPE',
 '{"cores":3,"size_sqmm":4,"conductor":"aluminium","insulation":"XLPE","sheath":"PVC","voltage_kv":1.1,"armoured":true}',
 'MTR'),

('ELEC-CABLE-CTRL-2CX1SQ-PVC-A', 'approved', 'ELEC', 'CABLE', 'CTRL', '2CX1MM-PVC', 'A',
 'Copper Control Cable 2 Core 1 Sqmm PVC Insulated PVC Sheathed 1.1kV Screened',
 'Cu Control Cable 2Cx1Sqmm',
 '{"cores":2,"size_sqmm":1,"conductor":"copper","insulation":"PVC","voltage_kv":1.1,"screened":true,"type":"control"}',
 'MTR'),

-- ELECTRICAL — MOTORS
('ELEC-MOTOR-INDU-5HP3P-415V-A', 'approved', 'ELEC', 'MOTOR', 'INDU', '5HP-3PH-415V', 'A',
 '3 Phase Induction Motor 5HP 415V 50Hz 1450RPM IP55 TEFC Frame 132S',
 '3-Ph Motor 5HP 415V',
 '{"power_hp":5,"phases":3,"voltage_v":415,"frequency_hz":50,"rpm":1450,"ip_rating":"IP55","type":"TEFC","frame":"132S"}',
 'EA'),

-- INTENTIONAL NEAR-DUPLICATE — different description, same motor (AI should flag this)
(NULL, 'pending', 'ELEC', 'MOTOR', 'INDU', '5HP-3PH-415V', 'A',
 '5 Horsepower 3-Phase Induction Motor 415 Volt 50 Hertz IP55',
 '5HP 3Phase Motor 415V',
 '{"power_hp":5,"phases":3,"voltage_v":415,"frequency_hz":50,"ip_rating":"IP55"}',
 'EA'),

-- ELECTRICAL — INSTRUMENTS
('ELEC-INSTR-GAUS-0100P-SS-A', 'approved', 'ELEC', 'INSTRU', 'GAUS', '0-100PSI-SS', 'A',
 'Pressure Gauge 0-100 PSI 2.5 Inch Dial Stainless Steel Bourdon Tube Glycerine Filled',
 'Pressure Gauge 0-100 PSI',
 '{"range_psi":"0-100","dial_inch":2.5,"material":"SS","type":"bourdon_tube","glycerine_filled":true}',
 'EA'),

-- CHEMICAL — LUBRICANTS
('CHEM-LUBR-HYDO-VG68-20L-A', 'approved', 'CHEM', 'LUBR', 'HYDO', 'VG68-20LTR', 'A',
 'Hydraulic Oil ISO VG 68 20 Litre HDPE Drum Anti-Wear Mineral Based',
 'Hydraulic Oil VG68 20L',
 '{"viscosity_grade":"ISO VG 68","volume_ltr":20,"container":"HDPE drum","base":"mineral","type":"hydraulic","anti_wear":true}',
 'EA'),

('CHEM-LUBR-GRES-EP2-1KG-A', 'approved', 'CHEM', 'LUBR', 'GRES', 'EP2-1KG', 'A',
 'Lithium EP Grease NLGI Grade 2 1 Kg Tin Extreme Pressure Multi-Purpose',
 'EP Grease NLGI-2 1Kg',
 '{"nlgi_grade":2,"weight_kg":1,"container":"tin","base":"lithium","type":"EP","multipurpose":true}',
 'EA'),

-- CONSUMABLES — PPE
('CONS-PPE-HELM-HDPE-IS2925-A', 'approved', 'CONS', 'PPE', 'HELM', 'HDPE-IS2925', 'A',
 'Safety Helmet HDPE Type 1 Class A IS 2925 with Ratchet Suspension Yellow',
 'Safety Helmet IS2925 Yellow',
 '{"material":"HDPE","type":"Type 1","class":"A","standard":"IS 2925","suspension":"ratchet","color":"yellow"}',
 'EA'),

('CONS-PPE-SHOE-STOE-SIZE8-A', 'approved', 'CONS', 'PPE', 'SHOE', 'STOE-S8-IS15298', 'A',
 'Safety Shoes Steel Toe Cap Size 8 IS 15298 Black Leather Upper Anti-Slip Sole',
 'Safety Shoes Steel Toe S8',
 '{"toe_cap":"steel","size":8,"standard":"IS 15298","color":"black","upper":"leather","sole":"anti_slip"}',
 'PR'),

('CONS-PPE-HARN-FULL-ANSIA10-A', 'approved', 'CONS', 'PPE', 'HARN', 'FULL-ANSIA10', 'A',
 'Full Body Safety Harness ANSI A10.32 Class E Polyester Webbing with Dorsal D-Ring',
 'Full Body Harness ANSI Class E',
 '{"type":"full_body","standard":"ANSI A10.32","class":"E","material":"polyester","d_ring":"dorsal"}',
 'EA'),

-- CONSUMABLES — WELDING
('CONS-WELD-ELEC-E6013-3M-A', 'approved', 'CONS', 'WELD', 'ELEC', 'E6013-3.2MM', 'A',
 'Welding Electrode E6013 General Purpose 3.2mm Dia 450mm Length 5Kg Pack',
 'Welding Electrode E6013 3.2mm',
 '{"classification":"E6013","diameter_mm":3.2,"length_mm":450,"pack_weight_kg":5,"type":"general_purpose"}',
 'PKT')

ON CONFLICT (cnmc) DO NOTHING;

-- ---- 18.4 Inventory seed ----

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-A-A1-R1-B1', 1500, 200, 500, 3000
FROM public.materials m WHERE m.cnmc = 'MECH-FSTNR-BOLT-M8X25-SS304-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-A-A1-R2-B1', 800, 100, 300, 2000
FROM public.materials m WHERE m.cnmc = 'MECH-FSTNR-NUT-M8-SS304-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-A-A1-R2-B2', 600, 50, 200, 1500
FROM public.materials m WHERE m.cnmc = 'MECH-FSTNR-WSHR-M8-SS304-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-A-A3-R1-B1', 25, 3, 10, 50
FROM public.materials m WHERE m.cnmc = 'MECH-VALVE-GATE-2INPN16-CS-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-A-A3-R1-B2', 40, 5, 15, 80
FROM public.materials m WHERE m.cnmc = 'MECH-VALVE-BALL-1INPN40-SS316-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-A-A2-R1-B1', 200, 20, 50, 500
FROM public.materials m WHERE m.cnmc = 'MECH-PIPE-PIPE-2INSS-SCH40-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-B-B2-R1-B1', 8, 1, 3, 20
FROM public.materials m WHERE m.cnmc = 'ELEC-MOTOR-INDU-5HP3P-415V-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-B-B1-R1-B1', 500, 0, 100, 1000
FROM public.materials m WHERE m.cnmc = 'ELEC-CABLE-CABLE-3CX4SQ-XLPE-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-C-C1-R1-B1', 45, 5, 15, 100
FROM public.materials m WHERE m.cnmc = 'CHEM-LUBR-HYDO-VG68-20L-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-C-C1-R2-B1', 80, 10, 30, 200
FROM public.materials m WHERE m.cnmc = 'CHEM-LUBR-GRES-EP2-1KG-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-C-C2-R1-B1', 120, 20, 50, 300
FROM public.materials m WHERE m.cnmc = 'CONS-PPE-HELM-HDPE-IS2925-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-C-C2-R1-B2', 60, 10, 25, 150
FROM public.materials m WHERE m.cnmc = 'CONS-PPE-SHOE-STOE-SIZE8-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

INSERT INTO public.inventory (material_id, location_code, quantity, reserved_quantity, reorder_level, max_stock)
SELECT m.id, 'WHSE-C-C3-R1-B1', 150, 30, 50, 400
FROM public.materials m WHERE m.cnmc = 'CONS-WELD-ELEC-E6013-3M-A'
ON CONFLICT (material_id, location_code) DO NOTHING;

-- ---- 18.5 Price History seed ----

-- M8 Bolt — FastFix Industries (VND-001) — 2 purchases, cheaper
INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 12.50, 500, '2024-01-15'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'MECH-FSTNR-BOLT-M8X25-SS304-A' AND v.code = 'VND-001';

INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 11.80, 800, '2024-04-20'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'MECH-FSTNR-BOLT-M8X25-SS304-A' AND v.code = 'VND-001';

INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 11.50, 1000, '2024-07-10'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'MECH-FSTNR-BOLT-M8X25-SS304-A' AND v.code = 'VND-001';

-- M8 Bolt — PipePro Supplies (VND-002) — more expensive
INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 14.20, 300, '2024-03-10'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'MECH-FSTNR-BOLT-M8X25-SS304-A' AND v.code = 'VND-002';

INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 13.50, 200, '2024-06-05'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'MECH-FSTNR-BOLT-M8X25-SS304-A' AND v.code = 'VND-002';

-- Motor — ElectroCore (VND-004)
INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 18500.00, 5, '2024-02-20'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'ELEC-MOTOR-INDU-5HP3P-415V-A' AND v.code = 'VND-004';

INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 17800.00, 3, '2024-08-15'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'ELEC-MOTOR-INDU-5HP3P-415V-A' AND v.code = 'VND-004';

-- Hydraulic Oil — LubriMax (VND-005)
INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 1850.00, 20, '2024-01-08'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'CHEM-LUBR-HYDO-VG68-20L-A' AND v.code = 'VND-005';

INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 1920.00, 25, '2024-05-22'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'CHEM-LUBR-HYDO-VG68-20L-A' AND v.code = 'VND-005';

-- Safety Helmets — SafeGear (VND-006)
INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 280.00, 100, '2024-03-15'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'CONS-PPE-HELM-HDPE-IS2925-A' AND v.code = 'VND-006';

INSERT INTO public.price_history (material_id, vendor_id, unit_price, quantity, purchase_date)
SELECT m.id, v.id, 265.00, 150, '2024-07-30'
FROM public.materials m, public.vendors v
WHERE m.cnmc = 'CONS-PPE-HELM-HDPE-IS2925-A' AND v.code = 'VND-006';

-- ---- 18.6 Legacy Code Mappings ----

INSERT INTO public.material_code_mappings (material_id, source_system, legacy_code, legacy_description)
SELECT m.id, 'SAP-MM', 'SAP-10000234', 'HEX BOLT M8X25 SS'
FROM public.materials m WHERE m.cnmc = 'MECH-FSTNR-BOLT-M8X25-SS304-A'
ON CONFLICT (source_system, legacy_code) DO NOTHING;

INSERT INTO public.material_code_mappings (material_id, source_system, legacy_code, legacy_description)
SELECT m.id, 'LEGACY-STORE', 'STR-BOLT-8-25-SS', 'S.S Hexagonal Bolt 8mm 25mm length'
FROM public.materials m WHERE m.cnmc = 'MECH-FSTNR-BOLT-M8X25-SS304-A'
ON CONFLICT (source_system, legacy_code) DO NOTHING;

INSERT INTO public.material_code_mappings (material_id, source_system, legacy_code, legacy_description)
SELECT m.id, 'DEPT-MECH', 'MECH-BLT-001', 'Hex Bolt Stainless M8'
FROM public.materials m WHERE m.cnmc = 'MECH-FSTNR-BOLT-M8X25-SS304-A'
ON CONFLICT (source_system, legacy_code) DO NOTHING;

INSERT INTO public.material_code_mappings (material_id, source_system, legacy_code, legacy_description)
SELECT m.id, 'SAP-MM', 'SAP-10005678', 'GATE VLV 2IN PN16'
FROM public.materials m WHERE m.cnmc = 'MECH-VALVE-GATE-2INPN16-CS-A'
ON CONFLICT (source_system, legacy_code) DO NOTHING;

INSERT INTO public.material_code_mappings (material_id, source_system, legacy_code, legacy_description)
SELECT m.id, 'STORE-MAIN', 'ST-GV-2-150', '2 inch Gate Valve 150 Class'
FROM public.materials m WHERE m.cnmc = 'MECH-VALVE-GATE-2INPN16-CS-A'
ON CONFLICT (source_system, legacy_code) DO NOTHING;

INSERT INTO public.material_code_mappings (material_id, source_system, legacy_code, legacy_description)
SELECT m.id, 'SAP-MM', 'SAP-20001100', '3PH MOTOR 5HP 415V'
FROM public.materials m WHERE m.cnmc = 'ELEC-MOTOR-INDU-5HP3P-415V-A'
ON CONFLICT (source_system, legacy_code) DO NOTHING;


-- ============================================================
-- DONE
-- ============================================================
-- TABLES:   12
--   public.profiles
--   public.vendors
--   public.materials
--   public.material_code_mappings
--   public.locations
--   public.inventory
--   public.goods_receipts
--   public.gr_line_items
--   public.price_history
--   public.matching_queue
--   public.audit_log
--   public.nl_query_log
--
-- VIEWS:    4
--   public.v_inventory_full
--   public.v_price_comparison
--   public.v_low_stock_alerts
--   public.v_matching_queue_detailed
--
-- FUNCTIONS: 6
--   public.handle_new_user()
--   public.set_updated_at()
--   public.generate_gr_number()
--   public.get_my_role()
--   public.search_materials_by_embedding()
--   public.get_inventory_value_by_category()
--   public.get_admin_dashboard_stats()
--
-- INDEXES:  28
-- RLS POLICIES: 30+
-- STORAGE BUCKET: bill-images
--
-- SEED DATA:
--   10 vendors
--   35 locations (3 warehouses)
--   22 materials (3 intentional duplicates for AI matching demo)
--   13 inventory records
--   10 price history records
--    6 legacy code mappings
-- ============================================================
