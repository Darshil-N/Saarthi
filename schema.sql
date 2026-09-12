-- ============================================================
-- NUMM (National Unified Material Master) – BharatOil
-- Supabase / PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ENUMS
CREATE TYPE material_status AS ENUM ('pending', 'approved', 'deprecated');
CREATE TYPE user_role AS ENUM ('entry_operator', 'engineer', 'accounts', 'admin');
CREATE TYPE match_type_enum AS ENUM ('exact', 'duplicate', 'near_duplicate', 'equivalent', 'different');
CREATE TYPE match_status_enum AS ENUM ('pending', 'approved', 'rejected');

-- profiles
CREATE TABLE profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  full_name  TEXT,
  role       user_role NOT NULL DEFAULT 'entry_operator',
  plant_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- vendors
CREATE TABLE vendors (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_code   TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  gstin         TEXT,
  pan           TEXT,
  address       TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- locations
CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,
  plant       TEXT NOT NULL,
  warehouse   TEXT NOT NULL,
  aisle       TEXT,
  rack        TEXT,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- materials
CREATE TABLE materials (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cnmc                 TEXT UNIQUE,
  category             TEXT NOT NULL,
  subcategory          TEXT NOT NULL,
  type                 TEXT,
  spec                 TEXT,
  quality              TEXT,
  standard_description TEXT NOT NULL,
  short_description    TEXT,
  uom                  TEXT NOT NULL DEFAULT 'EA',
  hsn_code             TEXT,
  quality_grade        TEXT,
  status               material_status NOT NULL DEFAULT 'pending',
  embedding            VECTOR(768),
  created_by           UUID REFERENCES profiles(id),
  approved_by          UUID REFERENCES profiles(id),
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_materials_embedding ON materials USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_materials_cnmc       ON materials(cnmc);
CREATE INDEX idx_materials_status     ON materials(status);
CREATE INDEX idx_materials_cat_subcat ON materials(category, subcategory);

-- material_code_mappings
CREATE TABLE material_code_mappings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  legacy_code TEXT NOT NULL UNIQUE,
  source      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_mcm_legacy_code ON material_code_mappings(legacy_code);

-- inventory
CREATE TABLE inventory (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id       UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  location_code     TEXT NOT NULL REFERENCES locations(code),
  quantity_on_hand  NUMERIC(15,3) NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC(15,3) NOT NULL DEFAULT 0,
  last_receipt_date DATE,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (material_id, location_code)
);
CREATE INDEX idx_inventory_material_id   ON inventory(material_id);
CREATE INDEX idx_inventory_location_code ON inventory(location_code);

-- goods_receipts
CREATE TABLE goods_receipts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id      UUID NOT NULL REFERENCES vendors(id),
  receipt_date   DATE NOT NULL,
  po_number      TEXT,
  bill_image_url TEXT,
  status         TEXT NOT NULL DEFAULT 'confirmed',
  created_by     UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- gr_line_items
CREATE TABLE gr_line_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  receipt_id   UUID NOT NULL REFERENCES goods_receipts(id) ON DELETE CASCADE,
  material_id  UUID REFERENCES materials(id),
  line_id      TEXT,
  description  TEXT NOT NULL,
  quantity     NUMERIC(15,3) NOT NULL,
  unit         TEXT NOT NULL,
  unit_price   NUMERIC(15,4) NOT NULL,
  total_price  NUMERIC(15,4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  batch_number TEXT,
  hsn_code     TEXT,
  location_code TEXT REFERENCES locations(code),
  barcode      TEXT,
  expiry_date  DATE,
  quality_grade TEXT,
  quality_notes TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_gr_line_items_receipt  ON gr_line_items(receipt_id);
CREATE INDEX idx_gr_line_items_material ON gr_line_items(material_id);

-- price_history
CREATE TABLE price_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  material_id   UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  vendor_id     UUID NOT NULL REFERENCES vendors(id),
  purchase_date DATE NOT NULL,
  unit_price    NUMERIC(15,4) NOT NULL,
  quantity      NUMERIC(15,3) NOT NULL,
  po_number     TEXT,
  receipt_id    UUID REFERENCES goods_receipts(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_price_history_material_date ON price_history(material_id, purchase_date DESC);

-- matching_queue
CREATE TABLE matching_queue (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incoming_description TEXT NOT NULL,
  incoming_specs       JSONB,
  candidate_material_id UUID REFERENCES materials(id),
  match_type           match_type_enum,
  match_status         match_status_enum NOT NULL DEFAULT 'pending',
  confidence_score     NUMERIC(5,4),
  similarity_score     NUMERIC(5,4),
  match_reason         TEXT,
  resolved_by          UUID REFERENCES profiles(id),
  resolved_at          TIMESTAMPTZ,
  gr_line_item_id      UUID REFERENCES gr_line_items(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_matching_queue_status ON matching_queue(match_status);

-- audit_log
CREATE TABLE audit_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES profiles(id),
  actor_role  user_role,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- nl_query_log
CREATE TABLE nl_query_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES profiles(id),
  query_text   TEXT NOT NULL,
  parsed_sql   TEXT,
  result_count INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_updated_at  BEFORE UPDATE ON profiles  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_vendors_updated_at   BEFORE UPDATE ON vendors   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_materials_updated_at BEFORE UPDATE ON materials FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_code_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gr_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE matching_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE nl_query_log ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb ->> 'role', 'anon');
$$;

-- profiles policies
CREATE POLICY profiles_self_read   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profiles_self_update ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY profiles_admin_all   ON profiles FOR ALL   USING (auth.role() = 'admin');
-- vendors
CREATE POLICY vendors_read_all  ON vendors FOR SELECT USING (TRUE);
CREATE POLICY vendors_admin_mut ON vendors FOR ALL    USING (auth.role() = 'admin');
-- locations
CREATE POLICY locations_read_all  ON locations FOR SELECT USING (TRUE);
CREATE POLICY locations_admin_mut ON locations FOR ALL    USING (auth.role() = 'admin');
-- materials
CREATE POLICY materials_read_all ON materials FOR SELECT USING (TRUE);
CREATE POLICY materials_insert_ops ON materials FOR INSERT WITH CHECK (auth.role() IN ('entry_operator','engineer','admin'));
CREATE POLICY materials_update_admin ON materials FOR UPDATE USING (auth.role()='admin' OR (auth.role() IN ('entry_operator','engineer') AND status='pending'));
-- goods_receipts
CREATE POLICY gr_insert_operator ON goods_receipts FOR INSERT WITH CHECK (auth.role() IN ('entry_operator','admin'));
CREATE POLICY gr_read_own ON goods_receipts FOR SELECT USING (created_by=auth.uid() OR auth.role() IN ('admin','engineer','accounts'));
-- gr_line_items
CREATE POLICY grli_insert ON gr_line_items FOR INSERT WITH CHECK (auth.role() IN ('entry_operator','admin'));
CREATE POLICY grli_read   ON gr_line_items FOR SELECT USING (TRUE);
-- matching_queue
CREATE POLICY mq_insert   ON matching_queue FOR INSERT WITH CHECK (auth.role() IN ('entry_operator','engineer','admin'));
CREATE POLICY mq_read     ON matching_queue FOR SELECT USING (TRUE);
CREATE POLICY mq_update   ON matching_queue FOR UPDATE USING (auth.role() IN ('entry_operator','engineer','admin'));
-- inventory
CREATE POLICY inv_read   ON inventory FOR SELECT USING (TRUE);
CREATE POLICY inv_mutate ON inventory FOR ALL    USING (auth.role() IN ('entry_operator','engineer','admin'));
-- price_history
CREATE POLICY ph_read   ON price_history FOR SELECT USING (auth.role() IN ('accounts','admin','engineer'));
CREATE POLICY ph_insert ON price_history FOR INSERT WITH CHECK (auth.role() IN ('entry_operator','admin'));
-- audit_log
CREATE POLICY al_insert ON audit_log FOR INSERT WITH CHECK (TRUE);
CREATE POLICY al_read   ON audit_log FOR SELECT USING (auth.role() IN ('admin','engineer'));
-- nl_query_log
CREATE POLICY nlq_own ON nl_query_log FOR ALL USING (user_id=auth.uid() OR auth.role()='admin');
