# Saarthi — Unified Material Master
## Complete Architecture & Build Document
### Oil & Gas CPSE Demo — "BharatOil"

---

## 1. PRODUCT OVERVIEW

**Product Name:** Saarthi — Unified Material Master  
**Demo Entity:** BharatOil (simulated Indian public sector oil company)  
**Tagline:** One Nation. One Material Code.  
**Purpose:** AI-powered platform to standardize, deduplicate, and intelligently manage material master data across departments of a public sector oil company — with the architecture to scale across multiple CPSEs.

---

## 2. TECH STACK

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | UI, dashboards, camera scanning |
| Styling | Tailwind CSS + Shadcn/ui | Component library, design system |
| State Management | Zustand + React Query (TanStack) | Global state + server state/caching |
| Backend | FastAPI (Python 3.11) | API layer, AI orchestration, business logic |
| Database | Supabase (PostgreSQL) | Primary database, auth, realtime, storage |
| Vector Search | pgvector (via Supabase) | Semantic similarity search for material matching |
| AI Model | Gemini 1.5 Flash | OCR, NL→SQL, material matching, description standardization |
| Embeddings | Gemini text-embedding-004 | Generate embeddings for material descriptions |
| Barcode Scanning | @zxing/browser | Webcam-based barcode/QR scanning in browser |
| Auth | Supabase Auth | Role-based login (4 roles) |
| File Storage | Supabase Storage | Bill images, scanned documents |
| Deployment | Vercel (React) + Render (FastAPI) | Free tier, production-grade |

---

## 3. ROLES & ACCESS CONTROL

Four roles exist in the system. Each role has a separate login that redirects to its own dashboard.

| Role | Dashboard | Primary Job |
|---|---|---|
| `entry_operator` | Entry Dashboard | Intake new stock via OCR/barcode, trigger AI matching, approve/reject mappings |
| `engineer` | Engineering Dashboard | Locate materials, check stock levels, use NL query |
| `accounts` | Accounts Dashboard | Monitor prices, price comparison, stock valuation, vendor data |
| `admin` | Admin Dashboard | Full visibility, audit trail, master data governance, user management |

Supabase Row Level Security (RLS) policies enforce data access per role. FastAPI middleware also validates JWT role claims on every request.

---

## 4. NATIONAL MATERIAL CODE FORMAT

Every material in the system gets a **Common National Material Code (CNMC)** in this format:

```
{CATEGORY}-{SUBCATEGORY}-{TYPE}-{SPEC}-{QUALITY}
```

**Example breakdown:**

| Segment | Value | Description |
|---|---|---|
| CATEGORY | `MECH` | Mechanical |
| SUBCATEGORY | `FSTNR` | Fasteners |
| TYPE | `BOLT` | Bolt |
| SPEC | `M8X25-SS304` | M8x25mm, Stainless Steel 304 |
| QUALITY | `A` | Grade A (A/B/C) |

**Full Code:** `MECH-FSTNR-BOLT-M8X25-SS304-A`

Rules:
- All segments uppercase, hyphen separated
- Max 6 chars per segment (abbreviated if needed)
- Generated automatically by Gemini based on extracted specs
- Unique per material variant
- CNMC is immutable once approved; changes require a new code + deprecation of old

**Oil & Gas Demo Category Tree (BharatOil):**

```
MECH — Mechanical
  └── FSTNR — Fasteners (Bolts, Nuts, Washers, Screws)
  └── PIPE — Pipes & Fittings
  └── VALVE — Valves
  └── SEAL — Gaskets & Seals
  └── BEAR — Bearings

ELEC — Electrical
  └── CABLE — Cables & Wires
  └── PANEL — Panels & Switchgear
  └── MOTOR — Motors
  └── INSTRU — Instruments & Sensors

CIVIL — Civil
  └── STRUCT — Structural Steel
  └── CMENT — Cement & Concrete
  └── SAFETY — Safety Equipment

CHEM — Chemical
  └── LUBR — Lubricants & Oils
  └── SOLV — Solvents & Cleaners
  └── COAT — Paints & Coatings

CONS — Consumables
  └── PPE — Personal Protective Equipment
  └── TOOL — Hand Tools
  └── WELD — Welding Consumables
```

---

## 5. DATABASE SCHEMA

### 5.1 Core Tables

```sql
-- USERS (managed by Supabase Auth, extended here)
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  role TEXT CHECK (role IN ('entry_operator','engineer','accounts','admin')),
  department TEXT,
  employee_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- VENDORS
vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,         -- e.g. VND-001
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  gstin TEXT,
  rating NUMERIC(2,1),               -- 1.0 to 5.0
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- MATERIAL MASTER (the canonical unified table)
materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnmc TEXT UNIQUE,                  -- Common National Material Code (nullable until approved)
  status TEXT CHECK (status IN ('pending','approved','deprecated')) DEFAULT 'pending',

  -- Classification
  category TEXT NOT NULL,            -- e.g. MECH
  subcategory TEXT NOT NULL,         -- e.g. FSTNR
  material_type TEXT NOT NULL,       -- e.g. BOLT
  spec TEXT,                         -- e.g. M8X25-SS304
  quality_grade TEXT,                -- A / B / C

  -- Descriptions
  standard_description TEXT NOT NULL, -- AI-standardized
  short_description TEXT,
  technical_specs JSONB,             -- { "thread_size": "M8", "length_mm": 25, "material": "SS304" }
  unit_of_measure TEXT NOT NULL,     -- EA, KG, MTR, LTR, SET

  -- Embedding for semantic search
  embedding VECTOR(768),

  -- Metadata
  created_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- LEGACY CODE MAPPING (each dept/source system may have their own codes)
material_code_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id),
  source_system TEXT NOT NULL,       -- e.g. 'SAP-MM', 'LEGACY-STORE', 'DEPT-MECH'
  legacy_code TEXT NOT NULL,
  legacy_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_system, legacy_code)
)

-- INVENTORY (current stock levels)
inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id),
  location_code TEXT NOT NULL,       -- e.g. WHSE-A-R3-B2 (warehouse-aisle-rack-bin)
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  reserved_quantity NUMERIC(12,3) DEFAULT 0,
  reorder_level NUMERIC(12,3),
  max_stock NUMERIC(12,3),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(material_id, location_code)
)

-- STOCK LOCATIONS (physical warehouse map)
locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,         -- WHSE-A-R3-B2
  warehouse TEXT NOT NULL,           -- WHSE-A
  aisle TEXT,                        -- A
  rack TEXT,                         -- R3
  bin TEXT,                          -- B2
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE
)

-- GOODS RECEIPT (incoming stock entry)
goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_number TEXT UNIQUE NOT NULL,    -- GR-2024-00001
  vendor_id UUID REFERENCES vendors(id),
  po_number TEXT,
  receipt_date DATE NOT NULL,
  received_by UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('draft','processing','completed','rejected')) DEFAULT 'draft',
  bill_image_url TEXT,               -- Supabase Storage URL
  ocr_raw_data JSONB,                -- Raw OCR output from Gemini
  total_value NUMERIC(14,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- GOODS RECEIPT LINE ITEMS
gr_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gr_id UUID REFERENCES goods_receipts(id),
  material_id UUID REFERENCES materials(id),
  quantity_received NUMERIC(12,3) NOT NULL,
  unit_of_measure TEXT NOT NULL,
  unit_price NUMERIC(12,4) NOT NULL,
  total_price NUMERIC(14,2) GENERATED ALWAYS AS (quantity_received * unit_price) STORED,
  quality_grade TEXT CHECK (quality_grade IN ('A','B','C')),
  quality_notes TEXT,
  location_code TEXT REFERENCES locations(code),
  barcode TEXT,
  batch_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- PRICE HISTORY (for price comparison across lots/vendors)
price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES materials(id),
  vendor_id UUID REFERENCES vendors(id),
  gr_line_item_id UUID REFERENCES gr_line_items(id),
  unit_price NUMERIC(12,4) NOT NULL,
  quantity NUMERIC(12,3),
  currency TEXT DEFAULT 'INR',
  purchase_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- AI MATCHING QUEUE (materials pending duplicate/equivalent detection)
matching_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_material_id UUID REFERENCES materials(id),
  matched_material_id UUID REFERENCES materials(id),
  match_type TEXT CHECK (match_type IN ('exact','duplicate','near_duplicate','equivalent')),
  confidence_score NUMERIC(4,3),     -- 0.000 to 1.000
  match_reason TEXT,
  ai_recommendation TEXT,            -- what Gemini recommends
  status TEXT CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- AUDIT TRAIL (all significant actions)
audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id),
  actor_role TEXT,
  action TEXT NOT NULL,              -- e.g. 'MATERIAL_APPROVED', 'MAPPING_REJECTED', 'CNMC_GENERATED'
  entity_type TEXT NOT NULL,         -- e.g. 'material', 'gr', 'matching_queue'
  entity_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- NL QUERY LOG (track engineer queries for analytics)
nl_query_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  natural_language_query TEXT NOT NULL,
  generated_sql TEXT,
  query_result_count INTEGER,
  execution_time_ms INTEGER,
  was_successful BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

### 5.2 Indexes

```sql
-- Vector similarity search
CREATE INDEX ON materials USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Frequent lookups
CREATE INDEX ON materials(cnmc);
CREATE INDEX ON materials(status);
CREATE INDEX ON materials(category, subcategory);
CREATE INDEX ON inventory(material_id);
CREATE INDEX ON inventory(location_code);
CREATE INDEX ON price_history(material_id, purchase_date DESC);
CREATE INDEX ON audit_log(entity_type, entity_id);
CREATE INDEX ON audit_log(actor_id, created_at DESC);
CREATE INDEX ON matching_queue(status);
```

---

## 6. SYSTEM ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + Vite)                   │
│                                                                   │
│   Landing Page   │  Entry  │  Engineer  │  Accounts  │  Admin    │
│                  │  Dashboard  │  Dashboard │  Dashboard │ Dashboard│
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / REST + Supabase Realtime
┌────────────────────────────▼────────────────────────────────────┐
│                      FASTAPI BACKEND                             │
│                                                                   │
│  /auth      /intake     /materials    /inventory    /analytics   │
│  /matching  /pricing    /nlquery      /audit        /dashboard   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   AI ORCHESTRATION LAYER                  │   │
│  │                                                           │   │
│  │  OCRService    MatchingService    NLQueryService         │   │
│  │  EmbeddingService  CNMCGenerator  PriceAnalyzer          │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────┬──────────────────┬────────────────────────┘
                      │                  │
         ┌────────────▼───┐    ┌─────────▼──────────┐
         │ Supabase       │    │  Gemini 1.5 Flash   │
         │ - PostgreSQL   │    │  - OCR              │
         │ - pgvector     │    │  - Embeddings       │
         │ - Auth         │    │  - NL→SQL           │
         │ - Storage      │    │  - Matching         │
         │ - Realtime     │    │  - CNMC Generation  │
         └────────────────┘    └────────────────────┘
```

---

## 7. DATA FLOW

### 7.1 Intake Flow (OCR Path)

```
User uploads bill image
        │
        ▼
Supabase Storage (save raw image)
        │
        ▼
FastAPI /intake/ocr
        │
        ▼
Gemini Vision API
  Prompt: "Extract all materials from this bill. For each line item return:
           description, quantity, unit, unit_price, total_price, batch_number.
           Return JSON only."
        │
        ▼
OCRService parses Gemini response → list of line items
        │
        ▼
For each line item:
  1. Generate embedding via Gemini text-embedding-004
  2. pgvector cosine similarity search against existing materials
  3. If similarity > 0.95 → exact/duplicate match
     If 0.75–0.95 → near-duplicate → queue for review
     If < 0.75 → new material
        │
        ▼
New materials → CNMCGenerator
  Prompt Gemini: "Given this material description and specs, generate a
                  CNMC in format CATEGORY-SUBCATEGORY-TYPE-SPEC-QUALITY
                  using this category tree: [tree]. Return JSON only."
        │
        ▼
Insert into materials (status: 'pending')
Insert into matching_queue (if near-duplicate found)
Insert into goods_receipts + gr_line_items
        │
        ▼
Entry operator sees results on screen:
  - Green: matched to existing approved material
  - Yellow: near-duplicate, needs review
  - Blue: new material, CNMC auto-generated, needs approval
        │
        ▼
Entry operator approves/rejects each item
        │
        ▼
Approved → update material status, update inventory, write price_history
All actions → audit_log
```

### 7.2 Intake Flow (Barcode Path)

```
Webcam stream via @zxing/browser
        │
        ▼
Barcode/QR decoded in browser → material code string
        │
        ▼
POST /intake/barcode { code: "..." }
        │
        ▼
Lookup material_code_mappings for legacy codes
  OR lookup materials.cnmc directly
        │
        ▼
If found → pre-fill material details in form
If not found → trigger same new material flow as OCR path
        │
        ▼
Operator confirms quantity, price, quality, location
        │
        ▼
Update inventory + price_history + audit_log
```

### 7.3 NL→SQL Flow

```
Engineer types: "How many M8 bolts are in Warehouse A?"
        │
        ▼
POST /nlquery { query: "...", role: "engineer" }
        │
        ▼
FastAPI builds prompt:
  "You are a SQL expert. Given this PostgreSQL schema:
   [schema summary]
   Convert this natural language query to a safe SELECT SQL statement.
   Rules: Only SELECT, no mutations. Use JOINs where needed.
   Query: 'How many M8 bolts are in Warehouse A?'
   Return JSON: { sql: '...', explanation: '...' }"
        │
        ▼
Gemini returns SQL
        │
        ▼
FastAPI validates: must be SELECT only, no DROP/DELETE/UPDATE
        │
        ▼
Execute against Supabase via supabase-py
        │
        ▼
Return results + SQL + explanation to frontend
Log to nl_query_log
```

### 7.4 Price Comparison Flow

```
Admin/Accounts views material price history
        │
        ▼
GET /pricing/comparison/{material_id}
        │
        ▼
Query price_history JOIN vendors
  GROUP BY vendor_id
  SELECT avg_price, min_price, max_price, last_purchase_price, purchase_count
        │
        ▼
Return ranked vendor list:
  Vendor A: ₹12.50/EA avg (last: ₹11.80) — 12 purchases
  Vendor B: ₹14.20/EA avg (last: ₹14.20) — 3 purchases
  → Recommended: Vendor A (₹2.40/unit cheaper)
        │
        ▼
Also show: price trend chart per vendor over time
Also show: quality grade distribution per vendor
           (A-grade % per vendor → quality score)
```

### 7.5 AI Matching Flow (Background)

```
Triggered automatically on every new material intake
        │
        ▼
FastAPI background task (FastAPI BackgroundTasks)
        │
        ▼
Generate embedding for new material description
        │
        ▼
pgvector: SELECT top-5 similar materials by cosine distance
        │
        ▼
For each candidate:
  Gemini prompt: "Are these two materials identical, duplicate,
                  near-duplicate, functionally equivalent, or different?
                  Material A: [details]
                  Material B: [details]
                  Return JSON: { match_type, confidence, reason }"
        │
        ▼
Insert results into matching_queue
        │
        ▼
If match_type = 'exact' OR 'duplicate' AND confidence > 0.9:
  → Auto-flag, notify entry operator immediately
If match_type = 'near_duplicate' OR 'equivalent':
  → Add to review queue, entry operator sees it in dashboard
If confidence < 0.6:
  → Log only, treat as new material
```

---

## 8. API ROUTES

### Auth
```
POST   /auth/login                    → login with email + password, returns JWT + role
POST   /auth/logout
GET    /auth/me                       → current user profile
```

### Intake
```
POST   /intake/ocr                    → upload bill image, get extracted line items
POST   /intake/barcode                → lookup by barcode/QR code
POST   /intake/confirm                → confirm intake after operator review
GET    /intake/receipts               → list all goods receipts
GET    /intake/receipts/{id}          → single GR with line items
```

### Materials
```
GET    /materials                     → list with filters (category, status, search)
GET    /materials/{id}                → single material detail
POST   /materials                     → create new material (auto-triggers matching)
PATCH  /materials/{id}/approve        → admin/entry approves material + CNMC
PATCH  /materials/{id}/deprecate      → admin deprecates material
GET    /materials/{id}/matches        → all AI match results for a material
GET    /materials/{id}/price-history  → price history across vendors
GET    /materials/search              → semantic search via pgvector
```

### Inventory
```
GET    /inventory                     → full inventory with location + stock levels
GET    /inventory/{material_id}       → stock for specific material across locations
GET    /inventory/low-stock           → items below reorder level
PATCH  /inventory/update              → adjust stock (internal use)
```

### Matching Queue
```
GET    /matching                      → list pending matches (entry operator)
PATCH  /matching/{id}/approve         → approve proposed mapping
PATCH  /matching/{id}/reject          → reject proposed mapping
```

### Pricing
```
GET    /pricing/comparison/{material_id}  → vendor price comparison
GET    /pricing/trends/{material_id}      → price trend over time per vendor
GET    /pricing/best-vendor/{material_id} → recommended vendor
```

### NL Query
```
POST   /nlquery                       → natural language to SQL
GET    /nlquery/history               → past queries for current user
```

### Dashboard
```
GET    /dashboard/entry               → entry operator stats
GET    /dashboard/engineer            → engineer stats + quick inventory
GET    /dashboard/accounts            → financial stats, valuation
GET    /dashboard/admin               → system-wide overview
```

### Audit
```
GET    /audit                         → full audit log (admin only), paginated
GET    /audit/{entity_type}/{id}      → audit history for specific entity
```

---

## 9. SCREENS & USER FLOWS

### 9.0 Landing Page (Public)

**URL:** `/`  
**Purpose:** Product showcase, login entry point

**Sections:**
1. Hero — "One Nation. One Material Code." with animated CNMC code generation visual
2. Problem statement — 3 stats (duplicate codes, wasted procurement budget, avg matching time)
3. Key capabilities — 6 cards (OCR Intake, AI Matching, NL Query, Price Intelligence, Quality Tracking, Audit Trail)
4. Demo stats — BharatOil live numbers (materials catalogued, duplicates detected, cost saved)
5. Login button → `/login`

---

### 9.1 Login Page

**URL:** `/login`

**Elements:**
- Email + Password
- On success: redirect based on role
  - `entry_operator` → `/entry`
  - `engineer` → `/engineer`
  - `accounts` → `/accounts`
  - `admin` → `/admin`

---

### 9.2 Entry Operator Dashboard

**URL:** `/entry`  
**Role:** `entry_operator`

#### Left Sidebar Navigation:
- Home (stats overview)
- New Receipt (OCR / Barcode)
- Pending Approvals (matching queue)
- Receipt History
- Locations

#### Screen: Home
- Cards: Today's receipts count, Items pending approval, New materials added, Duplicates detected today
- Recent activity feed (last 10 receipts with status)
- Realtime updates via Supabase Realtime

#### Screen: New Receipt
Two tabs: **OCR Upload** | **Barcode Scan**

**OCR Upload Tab:**
1. Drag & drop or click to upload bill image (PDF or image)
2. "Process with AI" button
3. Loading state: "Analyzing bill with Gemini Vision..."
4. Results table appears:
   | # | Description (extracted) | Qty | UoM | Unit Price | Matched Material | CNMC | Status | Quality |
   Each row is editable before confirming
5. Status badges:
   - 🟢 Exact Match — matched to existing approved material
   - 🟡 Near Duplicate — review needed (expandable: shows what it matched and why)
   - 🔵 New Material — CNMC auto-generated (editable)
   - 🔴 Uncertain — AI confidence low, manual classification needed
6. Quality grade input per line (A/B/C dropdown + notes)
7. Location assignment per line (dropdown of warehouse locations)
8. Vendor selection (dropdown)
9. "Confirm Receipt" button → creates GR, updates inventory

**Barcode Scan Tab:**
1. Webcam feed with scanning overlay (green box)
2. Scanned code appears instantly
3. If found → shows material card with current stock + location
4. Quantity received input + quality input
5. Location assignment
6. "Add to Receipt" button (can scan multiple items before confirming)
7. "Confirm All" → creates GR

#### Screen: Pending Approvals
- List of items in matching_queue with status = 'pending'
- Each card shows:
  - New material (what came in)
  - Matched material (what system thinks it might be)
  - Match type + confidence percentage
  - Gemini's reasoning
  - Two buttons: ✅ Approve Mapping | ❌ Reject (treat as new material)
- Approving a duplicate → marks new as deprecated, quantities merged to canonical
- Rejecting → new material proceeds with its own CNMC

#### Screen: Receipt History
- Table of all GRs with filters (date, vendor, status)
- Click → expand to see all line items with their processing status

---

### 9.3 Engineering Dashboard

**URL:** `/engineer`  
**Role:** `engineer`

#### Left Sidebar Navigation:
- Home
- Find Material (NL Search)
- Browse Catalog
- Inventory Map
- My Queries

#### Screen: Home
- Cards: Total materials in catalog, Items low on stock, My recent queries, Pending requisitions
- Quick search bar (NL query shortcut)

#### Screen: Find Material (NL Query — Flagship Feature)
- Large centered search bar: "Ask anything about materials and inventory..."
- Placeholder examples cycling: "Where are M8 stainless bolts?" / "How many gate valves are in stock?" / "Which location has the most pipe fittings?"
- On submit:
  1. Loading: "Generating query..."
  2. Shows generated SQL (collapsible, for transparency)
  3. Shows natural language explanation: "Searching for M8 stainless steel bolts across all warehouse locations..."
  4. Results table with:
     - Material name + CNMC
     - Warehouse → Aisle → Rack → Bin
     - Quantity available
     - Unit
  5. If multiple locations → sorted by quantity descending
  6. "Show on Map" button (warehouse grid visual)
- Query history panel on right: last 10 queries, click to re-run

#### Screen: Browse Catalog
- Material browser with filters: Category → Subcategory → Type
- Search by description or CNMC
- Each material card shows: CNMC, description, specs, current total stock, locations, last price paid
- Click → Material Detail page

#### Screen: Material Detail
- Full technical specs
- Current inventory by location (table)
- Price history chart (last 12 months)
- Vendor breakdown
- Audit history for this material
- Related/equivalent materials (from matching results)

#### Screen: Inventory Map
- Visual grid of Warehouse → Aisle → Rack → Bin
- Color coded by stock: 🟢 Good | 🟡 Low | 🔴 Critical | ⬜ Empty
- Click a bin → shows what materials are stored there

---

### 9.4 Accounts Dashboard

**URL:** `/accounts`  
**Role:** `accounts`

#### Left Sidebar Navigation:
- Home
- Price Intelligence
- Stock Valuation
- Vendor Analysis
- Purchase History

#### Screen: Home
- Cards: Total inventory value (₹), Spend this month, Best savings opportunity, Vendors active
- Alerts: Materials where a cheaper vendor is available but not being used
- Chart: Monthly spend trend (last 6 months)

#### Screen: Price Intelligence (Core Feature)
- Search or browse materials
- Select a material → shows:
  **Vendor Comparison Table:**
  | Vendor | Avg Price | Last Price | Min Price | Purchases | Quality (A%) | Recommendation |
  | Vendor A | ₹12.50 | ₹11.80 | ₹11.00 | 12 | 95% | ⭐ Best Value |
  | Vendor B | ₹14.20 | ₹14.20 | ₹13.50 | 3 | 87% | |
  
  **Price Trend Chart:** Line chart per vendor over time (last 12 months)
  
  **Savings Calculator:** 
  "If you switch to Vendor A for all purchases of this material, estimated annual saving: ₹45,200"

- Bulk view: "Materials where we can save by switching vendor" → sorted by potential saving

#### Screen: Stock Valuation
- Total inventory value by category (pie + table)
- Aging inventory: items not moved in 90/180/365 days
- Overstock alerts: items > 150% of max_stock

#### Screen: Vendor Analysis
- Vendor scorecards: price, quality grade %, delivery reliability (based on GR dates)
- Vendor → material matrix

#### Screen: Purchase History
- Full GR history with line items
- Filter by vendor, material, date range
- Export to CSV

---

### 9.5 Admin Dashboard

**URL:** `/admin`  
**Role:** `admin`

#### Left Sidebar Navigation:
- Home
- Material Governance
- Audit Trail
- Duplicate Detection
- User Management
- System Health

#### Screen: Home
- System-wide metrics:
  - Total materials in master: [N]
  - Approved CNMCs: [N]
  - Pending approval: [N]
  - Duplicates detected (all time): [N]
  - Data quality score: [%] (% of materials with complete specs)
- Quick actions: Review pending materials, View new duplicates, Approve bulk CNMCs

#### Screen: Material Governance
- All materials in system with status filter (pending/approved/deprecated)
- Bulk approve / bulk deprecate
- Edit any material's standard description, specs, CNMC (with reason — goes to audit log)
- View all code mappings for a material (CNMC ↔ legacy codes)
- Merge two materials (one deprecated, quantities transferred)

#### Screen: Audit Trail
- Full chronological log of all system actions
- Filters: actor, action type, entity type, date range
- Each row: timestamp, who, what action, on what entity, old value → new value
- Export to CSV

#### Screen: Duplicate Detection
- All items in matching_queue (all statuses)
- Stats: auto-resolved, pending review, rejected
- Bulk review interface
- Duplicate "families" — groups of materials that are all equivalent to each other

#### Screen: User Management
- List all users with role
- Create new user, assign role
- Deactivate user

#### Screen: System Health
- API response times
- Gemini API usage (tokens used today / month)
- pgvector query performance
- Database size
- Recent errors / failed OCR jobs

---

## 10. FRONTEND COMPONENT ARCHITECTURE

```
src/
├── main.jsx
├── App.jsx                     → router setup
├── lib/
│   ├── supabase.js             → supabase client
│   ├── api.js                  → axios instance with auth headers
│   └── utils.js
├── store/
│   ├── authStore.js            → zustand: user, role, session
│   └── intakeStore.js          → zustand: current intake session state
├── hooks/
│   ├── useAuth.js
│   ├── useMaterials.js         → react-query hooks
│   ├── useInventory.js
│   ├── usePricing.js
│   └── useAudit.js
├── pages/
│   ├── Landing.jsx
│   ├── Login.jsx
│   ├── entry/
│   │   ├── EntryDashboard.jsx
│   │   ├── NewReceipt.jsx
│   │   ├── OCRUpload.jsx
│   │   ├── BarcodeScanner.jsx
│   │   └── PendingApprovals.jsx
│   ├── engineer/
│   │   ├── EngineerDashboard.jsx
│   │   ├── NLQuery.jsx
│   │   ├── MaterialCatalog.jsx
│   │   ├── MaterialDetail.jsx
│   │   └── InventoryMap.jsx
│   ├── accounts/
│   │   ├── AccountsDashboard.jsx
│   │   ├── PriceIntelligence.jsx
│   │   ├── StockValuation.jsx
│   │   └── VendorAnalysis.jsx
│   └── admin/
│       ├── AdminDashboard.jsx
│       ├── MaterialGovernance.jsx
│       ├── AuditTrail.jsx
│       ├── DuplicateDetection.jsx
│       └── UserManagement.jsx
├── components/
│   ├── layout/
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   └── ProtectedRoute.jsx
│   ├── materials/
│   │   ├── MaterialCard.jsx
│   │   ├── CNMCBadge.jsx
│   │   ├── MatchStatusBadge.jsx
│   │   └── SpecsTable.jsx
│   ├── intake/
│   │   ├── OCRResultsTable.jsx
│   │   ├── BarcodeOverlay.jsx
│   │   └── LineItemEditor.jsx
│   ├── charts/
│   │   ├── PriceTrendChart.jsx
│   │   ├── SpendChart.jsx
│   │   └── CategoryPieChart.jsx
│   └── ui/                     → shadcn components
```

---

## 11. BACKEND ARCHITECTURE

```
backend/
├── main.py                     → FastAPI app init, middleware, CORS
├── config.py                   → env vars (Supabase URL, Gemini key)
├── database.py                 → supabase-py client
├── dependencies.py             → auth middleware, role checking
├── routers/
│   ├── auth.py
│   ├── intake.py
│   ├── materials.py
│   ├── inventory.py
│   ├── matching.py
│   ├── pricing.py
│   ├── nlquery.py
│   ├── dashboard.py
│   └── audit.py
├── services/
│   ├── ocr_service.py          → Gemini Vision OCR + parsing
│   ├── embedding_service.py    → Gemini embeddings generation
│   ├── matching_service.py     → pgvector search + Gemini match scoring
│   ├── cnmc_service.py         → CNMC code generation via Gemini
│   ├── nlquery_service.py      → NL→SQL via Gemini + safe execution
│   ├── price_service.py        → price comparison + vendor ranking
│   └── audit_service.py        → write to audit_log
├── models/
│   ├── material.py             → Pydantic models
│   ├── inventory.py
│   ├── intake.py
│   └── matching.py
└── prompts/
    ├── ocr_prompt.txt          → OCR extraction prompt template
    ├── matching_prompt.txt     → Material matching prompt template
    ├── cnmc_prompt.txt         → CNMC generation prompt template
    └── nlquery_prompt.txt      → NL→SQL prompt template
```

---

## 12. AI PROMPTS (Key Templates)

### OCR Extraction
```
You are a materials procurement assistant for an Indian public sector oil company.
Extract all line items from this bill/invoice image.

For each line item, return:
- description: full material description as written
- quantity: numeric value only
- unit: unit of measure (EA, KG, MTR, LTR, SET, etc.)
- unit_price: numeric value in INR
- batch_number: if present, else null
- hsn_code: if present, else null

Return ONLY a JSON array. No explanation. No markdown.
Example: [{"description":"...", "quantity":100, "unit":"EA", "unit_price":12.50, "batch_number":null, "hsn_code":null}]
```

### CNMC Generation
```
You are a material classification expert for Indian public sector oil & gas companies.
Generate a Common National Material Code (CNMC) for this material.

Format: CATEGORY-SUBCATEGORY-TYPE-SPEC-QUALITY
Rules:
- Each segment: max 6 chars, uppercase, alphanumeric only
- SPEC: encode key technical parameter (size, grade, rating)
- QUALITY: A (premium), B (standard), C (economy) — infer from description or specs

Category tree:
MECH: FSTNR, PIPE, VALVE, SEAL, BEAR
ELEC: CABLE, PANEL, MOTOR, INSTRU
CIVIL: STRUCT, CMENT, SAFETY
CHEM: LUBR, SOLV, COAT
CONS: PPE, TOOL, WELD

Material description: {description}
Technical specs: {specs}
Quality grade: {quality}

Return ONLY JSON: {"cnmc": "...", "category": "...", "subcategory": "...", "type": "...", "spec": "...", "quality": "...", "standard_description": "...", "short_description": "..."}
```

### Material Matching
```
You are a material deduplication expert for a national material master system.
Determine if these two materials are the same, similar, or different.

Material A (existing):
Description: {desc_a}
CNMC: {cnmc_a}
Specs: {specs_a}

Material B (incoming):
Description: {desc_b}
Specs: {specs_b}

Classify the match as one of:
- exact: identical material, same specs
- duplicate: same material, minor description difference
- near_duplicate: very likely same material, small spec difference possible (verify)
- equivalent: functionally interchangeable but different spec/grade
- different: distinct materials

Return ONLY JSON: {"match_type": "...", "confidence": 0.00, "reason": "..."}
Confidence: 0.0 to 1.0
```

### NL→SQL
```
You are a PostgreSQL expert for a material management system.
Convert the natural language query to a safe SQL SELECT statement.

Database schema (relevant tables):
- materials(id, cnmc, category, subcategory, material_type, spec, standard_description, unit_of_measure, quality_grade, status)
- inventory(id, material_id, location_code, quantity, reserved_quantity, reorder_level)
- locations(code, warehouse, aisle, rack, bin, description)
- vendors(id, name, code)
- price_history(id, material_id, vendor_id, unit_price, purchase_date)
- gr_line_items(id, material_id, quantity_received, unit_price, quality_grade, batch_number)

Rules:
- Only SELECT statements allowed
- Always filter materials.status = 'approved' unless asked otherwise
- Use meaningful column aliases
- Limit results to 100 rows unless a specific count is requested
- Join tables as needed

Natural language query: {query}

Return ONLY JSON: {"sql": "SELECT ...", "explanation": "This query..."}
```

---

## 13. DEMO DATA — BHARATOIL

### Departments (simulated as source systems)
- `MECH-DEPT` — Mechanical Engineering
- `ELEC-DEPT` — Electrical Engineering  
- `CIVIL-DEPT` — Civil & Structural
- `PROC-DEPT` — Procurement
- `STORE-MAIN` — Main Stores (SAP-MM)

### Vendors (10 seeded vendors)
- FastFix Industries (fasteners)
- PipePro Supplies (pipes & fittings)
- ValveTech India (valves)
- ElectroCore Ltd (electrical)
- LubriMax India (lubricants)
- SafeGear Pvt Ltd (PPE)
- WeldPro Supplies (welding)
- SteelCraft India (structural)
- ChemiFluid Ltd (chemicals)
- ToolMart India (tools)

### Seed Materials (50+ materials across categories)
Includes intentional duplicates and near-duplicates to demonstrate the AI matching:
- "Hex Bolt M8x25 SS304" (from MECH-DEPT) matches "S.S Hexagonal Bolt 8mm 25mm length" (from legacy STORE-MAIN)
- "Gate Valve 2 inch PN16" matches "2'' Gate Valve Class 150"
- "3 Phase Induction Motor 5HP" matches "5 Horsepower 3-Phase Motor 415V"

### Warehouse Layout
```
WHSE-A (Main Warehouse)
  Aisle-1: Fasteners, Bolts, Nuts (A1-R1 through A1-R5)
  Aisle-2: Pipes & Fittings (A2-R1 through A2-R4)
  Aisle-3: Valves (A3-R1 through A3-R3)

WHSE-B (Electrical Store)
  Aisle-1: Cables & Wires (B1-R1 through B1-R4)
  Aisle-2: Motors & Panels (B2-R1 through B2-R2)
  Aisle-3: Instruments (B3-R1)

WHSE-C (Chemical & Consumables)
  Aisle-1: Lubricants & Oils (C1-R1 through C1-R2)
  Aisle-2: PPE (C2-R1 through C2-R3)
  Aisle-3: Welding & Tools (C3-R1 through C3-R2)
```

---

## 14. 10-DAY BUILD PLAN

### Day 1 — Foundation
- [ ] Supabase project setup, all tables created, RLS policies written
- [ ] FastAPI project init, folder structure, Gemini API connected, health endpoint
- [ ] React + Vite + Tailwind + Shadcn setup, routing configured
- [ ] Supabase Auth connected, login page working, role-based redirect working

### Day 2 — Data & Seed
- [ ] All seed data inserted (vendors, locations, 50+ materials with duplicates)
- [ ] pgvector enabled, embeddings generated for all seed materials
- [ ] Supabase Storage bucket for bill images
- [ ] Auth protected routes, role guards working

### Day 3 — OCR Intake
- [ ] OCR service: Gemini Vision integration, bill parsing
- [ ] OCR upload UI: drag/drop, processing state, results table
- [ ] Line item editor (qty, price, quality, location all editable)
- [ ] Save draft GR to database

### Day 4 — Barcode + Matching Engine
- [ ] @zxing/browser webcam scanning working
- [ ] Barcode lookup → material pre-fill
- [ ] Embedding service: generate embeddings for new materials
- [ ] pgvector similarity search working
- [ ] Gemini match scoring (exact / duplicate / near-duplicate / equivalent)
- [ ] matching_queue inserts working

### Day 5 — CNMC + Approval Flow
- [ ] CNMC generator service: Gemini prompt → code parsing → validation
- [ ] Pending approvals screen (entry dashboard)
- [ ] Approve/reject matching queue items
- [ ] Inventory update on confirmation
- [ ] price_history insert on confirmation
- [ ] audit_log writes for all actions

### Day 6 — Engineering Dashboard
- [ ] NL→SQL service: Gemini prompt → SQL → safe execution
- [ ] NL query UI with results table + SQL reveal
- [ ] Material catalog (browse + filter)
- [ ] Material detail page
- [ ] Inventory map (warehouse grid visual)

### Day 7 — Accounts Dashboard
- [ ] Price comparison: vendor ranking, savings calculator
- [ ] Price trend charts (Recharts)
- [ ] Stock valuation by category (pie chart)
- [ ] Vendor analysis scorecards

### Day 8 — Admin Dashboard
- [ ] Material governance: full material list, bulk approve
- [ ] Audit trail page (paginated, filterable)
- [ ] Duplicate detection overview
- [ ] System health (basic stats)

### Day 9 — Landing Page + Polish
- [ ] Landing page with live BharatOil stats
- [ ] Mobile responsive check on all dashboards
- [ ] Error states, loading states, empty states on all screens
- [ ] Demo flow rehearsal: OCR → duplicate detected → approved → engineer queries → accounts sees price comparison

### Day 10 — Demo Prep
- [ ] Record sample bill images for OCR demo (2-3 realistic oil company bills)
- [ ] Pre-seed some matched duplicates to show in matching queue
- [ ] Rehearse full demo narrative
- [ ] Deployment: Vercel + Render, environment variables set
- [ ] README with setup instructions

---

## 15. ENVIRONMENT VARIABLES

### Frontend (.env)
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=https://your-render-app.onrender.com
```

### Backend (.env)
```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GEMINI_API_KEY=
ALLOWED_ORIGINS=https://your-vercel-app.vercel.app,http://localhost:5173
```

---

## 16. DEPLOYMENT

| Service | Platform | Plan | Cost |
|---|---|---|---|
| React Frontend | Vercel | Hobby (free) | ₹0 |
| FastAPI Backend | Render | Free web service | ₹0 |
| Database + Auth + Storage | Supabase | Free tier (500MB, 50MB storage) | ₹0 |
| AI | Gemini API | Free tier (15 req/min Flash) | ₹0 |

**Note:** Render free tier spins down after inactivity. For demo day, keep a warm-up ping running or upgrade to Render Starter ($7/mo) for 1 month.

---

## 17. KEY DEMO NARRATIVE (3 min walkthrough)

1. **Land on landing page** — "BharatOil: One Nation, One Material Code"
2. **Login as Entry Operator** → upload a bill photo → watch Gemini extract 8 line items in seconds
3. **AI detects a duplicate** → "Hex Bolt M8x25 SS304" already exists as "S.S Hexagonal Bolt 8mm" → approve mapping → no new code created, stock added to existing material
4. **New material flows through** → CNMC auto-generated: `MECH-FSTNR-BOLT-M8X25-SS304-A`
5. **Switch to Engineer** → type "Where are M8 bolts and how many do we have?" → SQL runs → results in 2 seconds with exact bin location
6. **Switch to Accounts** → pull up M8 bolt price comparison → Vendor A: ₹11.80, Vendor B: ₹14.20 → "Switch to Vendor A, save ₹45,200 annually"
7. **Switch to Admin** → show audit trail → every action logged with who, when, what changed

---

*Document version: 1.0 | Project: Saarthi | Entity: BharatOil Demo*
