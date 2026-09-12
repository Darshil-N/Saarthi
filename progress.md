# NUMM — Project Progress
## BharatOil Demo | Active Build Tracker

**Last Updated:** Day 0 — Pre-build  
**Overall Progress:** 0 / 130 steps complete  
**Status:** 🔴 Not Started

---

## HOW TO USE THIS FILE

- Update `[Status]` per step: `[ ]` not started → `[~]` in progress → `[x]` done → `[!]` blocked
- Update `Notes` with what was done, what broke, what changed
- Update `Last Updated` and `Overall Progress` at the top after every session
- Mark blockers with `[!]` and add a note immediately so anyone picking it up knows the context

**Status Key:**
| Symbol | Meaning |
|---|---|
| `[ ]` | Not started |
| `[~]` | In progress |
| `[x]` | Complete |
| `[!]` | Blocked — see notes |
| `[-]` | Skipped / not needed |

---

---

# PHASE 1 — Foundation
**Target:** Days 1–2  
**Status:** 🔴 Not Started  
**Steps Complete:** 0 / 20

---

## Part 1.1 — Project Setup
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 1.1.1 | Initialize React + Vite + Tailwind + Shadcn | [ ] | |
| 1.1.2 | Initialize FastAPI project with folder structure | [ ] | |
| 1.1.3 | Set up environment variables for both frontend and backend | [ ] | |
| 1.1.4 | Configure CORS, middleware, and health check endpoint | [ ] | |

---

## Part 1.2 — Supabase Setup
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 1.2.1 | Create Supabase project | [ ] | |
| 1.2.2 | Run all table creation SQL (12 tables) | [ ] | Tables: profiles, vendors, materials, material_code_mappings, inventory, locations, goods_receipts, gr_line_items, price_history, matching_queue, audit_log, nl_query_log |
| 1.2.3 | Enable pgvector extension | [ ] | Run: `create extension vector` in Supabase SQL editor |
| 1.2.4 | Write and apply RLS policies per role | [ ] | 4 roles: entry_operator, engineer, accounts, admin |
| 1.2.5 | Create Supabase Storage bucket for bill images | [ ] | Bucket name: `bill-images`, public read off |

---

## Part 1.3 — Authentication
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 1.3.1 | Connect Supabase Auth to FastAPI (JWT validation middleware) | [ ] | Use supabase-py, validate JWT on every protected route |
| 1.3.2 | Connect Supabase Auth to React (session management) | [ ] | Use @supabase/supabase-js, store session in Zustand authStore |
| 1.3.3 | Build Login page with role-based redirect | [ ] | Route: /login — redirect to /entry, /engineer, /accounts, /admin based on role in profile |
| 1.3.4 | Build ProtectedRoute component with role guard | [ ] | Wrap all dashboard routes, redirect to /login if no session |

---

## Part 1.4 — Seed Data
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** Seed order matters — vendors and locations before materials, materials before inventory and price_history

| # | Step | Status | Notes |
|---|---|---|---|
| 1.4.1 | Seed vendors (10 vendors) | [ ] | FastFix, PipePro, ValveTech, ElectroCore, LubriMax, SafeGear, WeldPro, SteelCraft, ChemiFluid, ToolMart |
| 1.4.2 | Seed warehouse locations (3 warehouses, all aisles and bins) | [ ] | WHSE-A (mechanical), WHSE-B (electrical), WHSE-C (chemicals & consumables) |
| 1.4.3 | Seed 50+ materials with intentional duplicates and near-duplicates | [ ] | Include at least 5 duplicate pairs for demo — see architecture.md §13 |
| 1.4.4 | Generate and store embeddings for all seeded materials | [ ] | Call Gemini text-embedding-004 per material, store in materials.embedding |
| 1.4.5 | Seed inventory levels across locations | [ ] | Mix of healthy stock, low stock, and overstock for dashboard variety |
| 1.4.6 | Seed price history (6 months, multiple vendors per material) | [ ] | Ensure some materials have clearly cheaper vendors for accounts demo |
| 1.4.7 | Seed user accounts for all 4 roles | [ ] | entry@bharatoil.in, engineer@bharatoil.in, accounts@bharatoil.in, admin@bharatoil.in |

---

**Phase 1 Completion Checklist:**
- [ ] Both frontend and backend run locally without errors
- [ ] Login works for all 4 roles and redirects correctly
- [ ] All 12 tables exist in Supabase with correct schema
- [ ] pgvector enabled and materials table has embedding column populated
- [ ] All seed data visible in Supabase table editor

---

---

# PHASE 2 — Intake Pipeline
**Target:** Days 3–4  
**Status:** 🔴 Not Started  
**Steps Complete:** 0 / 24

---

## Part 2.1 — OCR Service (Backend)
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 2.1.1 | Integrate Gemini Vision API in FastAPI | [ ] | Use google-generativeai SDK, model: gemini-1.5-flash |
| 2.1.2 | Write OCR prompt template and parser | [ ] | See architecture.md §12 for prompt. Parser converts raw Gemini JSON to OCRLineItem Pydantic model |
| 2.1.3 | Build bill image upload endpoint (save to Supabase Storage) | [ ] | POST /intake/upload-bill — returns storage URL |
| 2.1.4 | Build OCR extraction endpoint returning structured line items | [ ] | POST /intake/ocr — takes storage URL, returns list of line items with match suggestions |
| 2.1.5 | Handle multi-page PDFs and image quality fallbacks | [ ] | If Gemini returns low-confidence extraction, flag line item as Uncertain |

---

## Part 2.2 — OCR UI (Frontend)
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 2.2.1 | Build drag-and-drop bill upload component | [ ] | Accept PDF and image files, show preview thumbnail |
| 2.2.2 | Build processing / loading state | [ ] | Animated spinner with "Analyzing bill with AI..." message |
| 2.2.3 | Build OCR results table (editable: qty, price, quality, location) | [ ] | Inline editing — click cell to edit. Quality dropdown (A/B/C). Location dropdown from locations table |
| 2.2.4 | Build match status badges (Exact / Near-Duplicate / New / Uncertain) | [ ] | Green / Yellow / Blue / Red badges. Near-Duplicate expandable to show matched material and confidence |
| 2.2.5 | Build "Confirm Receipt" flow and GR creation | [ ] | Disabled until all rows have location assigned. Shows GR number on success |

---

## Part 2.3 — Barcode Scanner (Frontend + Backend)
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 2.3.1 | Integrate @zxing/browser webcam scanning | [ ] | npm install @zxing/browser. Use BrowserMultiFormatReader for broad format support |
| 2.3.2 | Build scanning overlay UI with live camera feed | [ ] | Green animated box on detected barcode. Show decoded value below feed |
| 2.3.3 | Build barcode lookup endpoint (CNMC + legacy code lookup) | [ ] | POST /intake/barcode — checks material_code_mappings first, then materials.cnmc |
| 2.3.4 | Build material pre-fill on successful scan | [ ] | Auto-populate description, unit, last known price from price_history |
| 2.3.5 | Build multi-item scan session before confirming GR | [ ] | Running list of scanned items, quantity input per item, "Add Another" flow |

---

## Part 2.4 — Goods Receipt Management
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 2.4.1 | Build GR creation endpoint (header + line items) | [ ] | POST /intake/confirm — creates goods_receipt + gr_line_items in transaction |
| 2.4.2 | Build GR list screen with filters | [ ] | Filter by: date range, vendor, status. Show GR number, vendor, item count, total value, status |
| 2.4.3 | Build GR detail screen with line item breakdown | [ ] | All line items with material, qty, price, quality, location |
| 2.4.4 | Build inventory update on GR confirmation | [ ] | UPSERT into inventory — add received qty to existing stock at given location |
| 2.4.5 | Build price_history insert on GR confirmation | [ ] | Insert one row per line item into price_history |

---

**Phase 2 Completion Checklist:**
- [ ] Can upload a real bill photo and get back extracted line items
- [ ] Can scan a barcode with laptop webcam and find the material
- [ ] Confirming a GR updates inventory quantities in Supabase
- [ ] Price history table gets new rows on every GR confirmation
- [ ] GR history screen shows all receipts with correct status

---

---

# PHASE 3 — AI Core
**Target:** Days 4–5  
**Status:** 🔴 Not Started  
**Steps Complete:** 0 / 21

---

## Part 3.1 — Embedding Service
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 3.1.1 | Integrate Gemini text-embedding-004 in FastAPI | [ ] | Model: models/text-embedding-004, output dimension: 768 |
| 3.1.2 | Build embedding generation for incoming material descriptions | [ ] | Concatenate: description + key specs into one string before embedding |
| 3.1.3 | Build pgvector cosine similarity search | [ ] | SELECT ... ORDER BY embedding <=> $1 LIMIT 5 |
| 3.1.4 | Set similarity thresholds (exact / near-dup / new) | [ ] | >0.95 = exact, 0.75–0.95 = near-dup, <0.75 = new. Tune with seed data |

---

## Part 3.2 — Material Matching Engine
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 3.2.1 | Build matching_service with pgvector top-5 candidate retrieval | [ ] | Returns list of (material_id, similarity_score) tuples |
| 3.2.2 | Build Gemini scoring prompt for each candidate pair | [ ] | See architecture.md §12 for prompt. Returns match_type + confidence + reason |
| 3.2.3 | Build matching_queue insert logic per result | [ ] | Insert one row per candidate that passes minimum threshold |
| 3.2.4 | Wire matching as a FastAPI BackgroundTask on every new material intake | [ ] | Non-blocking — intake response returns immediately, matching runs in background |
| 3.2.5 | Build auto-resolution for high-confidence exact matches | [ ] | If confidence > 0.95 and match_type = exact: auto-flag without human review |

---

## Part 3.3 — CNMC Generator
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 3.3.1 | Build CNMC generation prompt with category tree | [ ] | See architecture.md §12. Category tree hardcoded in prompt |
| 3.3.2 | Build CNMC parser and validator (format check) | [ ] | Regex: ^[A-Z]{2,6}-[A-Z]{2,6}-[A-Z]{2,6}-[A-Z0-9]{2,8}-[ABC]$ |
| 3.3.3 | Build uniqueness check against existing CNMCs | [ ] | SELECT from materials WHERE cnmc = generated_cnmc |
| 3.3.4 | Build collision handler (append suffix if CNMC already exists) | [ ] | e.g. MECH-FSTNR-BOLT-M8X25-SS304-A already exists → MECH-FSTNR-BOLT-M8X25-SS304-A2 |
| 3.3.5 | Wire CNMC generation into new material intake flow | [ ] | Called after OCR extraction, before returning results to frontend |

---

## Part 3.4 — Approval Workflow
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 3.4.1 | Build pending approvals list endpoint | [ ] | GET /matching?status=pending — returns queue with both materials' full details |
| 3.4.2 | Build approve-mapping endpoint (merge quantities, deprecate duplicate) | [ ] | PATCH /matching/{id}/approve — sets canonical material, transfers qty, deprecates duplicate |
| 3.4.3 | Build reject-mapping endpoint (proceed as new material) | [ ] | PATCH /matching/{id}/reject — new material proceeds independently |
| 3.4.4 | Build Pending Approvals screen (Entry dashboard) | [ ] | Card per queue item: side-by-side material comparison, confidence bar, reason, approve/reject buttons |
| 3.4.5 | Build approval confirmation with audit log write | [ ] | Every approve/reject writes to audit_log with actor, action, old/new values |

---

**Phase 3 Completion Checklist:**
- [ ] New material intake triggers background matching job automatically
- [ ] Matching queue populates with correct match types and confidence scores
- [ ] CNMC is generated for every new material before results return to frontend
- [ ] Entry operator can approve or reject each match from the UI
- [ ] Approving a duplicate correctly merges stock and deprecates the duplicate
- [ ] Every approval/rejection is written to audit_log

---

---

# PHASE 4 — Engineering Dashboard
**Target:** Day 6  
**Status:** 🔴 Not Started  
**Steps Complete:** 0 / 19

---

## Part 4.1 — NL→SQL Service
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 4.1.1 | Build NL→SQL Gemini prompt with schema context | [ ] | See architecture.md §12. Include all relevant table schemas in prompt |
| 4.1.2 | Build SQL safety validator (SELECT only, no mutations) | [ ] | Parse returned SQL, reject if contains: INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER |
| 4.1.3 | Build safe query executor against Supabase | [ ] | Use supabase-py .rpc() or direct postgres connection via asyncpg |
| 4.1.4 | Build nl_query_log insert on every query | [ ] | Log: user_id, query, generated_sql, result_count, execution_time_ms, was_successful |
| 4.1.5 | Build error handling for invalid SQL | [ ] | Return user-friendly error + fallback message if SQL fails or returns no results |

---

## Part 4.2 — NL Query UI
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 4.2.1 | Build NL query search bar with example placeholders | [ ] | Cycling placeholder text: "Where are M8 bolts?", "How many gate valves in stock?", "Which bin has pipe fittings?" |
| 4.2.2 | Build loading and streaming state | [ ] | Two-phase: "Generating query..." then "Fetching results..." |
| 4.2.3 | Build results table with material + location columns | [ ] | Columns: Material, CNMC, Warehouse, Aisle, Rack, Bin, Qty Available, Unit |
| 4.2.4 | Build SQL reveal (collapsible) with explanation | [ ] | Accordion below results: shows generated SQL + plain English explanation |
| 4.2.5 | Build query history panel | [ ] | Right sidebar: last 10 queries, click to re-run |

---

## Part 4.3 — Material Catalog & Detail
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 4.3.1 | Build material catalog with category filter tree | [ ] | Left panel: MECH > FSTNR / PIPE / VALVE etc. Clicking filters results |
| 4.3.2 | Build material search (description + CNMC) | [ ] | Search hits standard_description and cnmc columns |
| 4.3.3 | Build material detail page (specs, inventory, price history) | [ ] | Route: /engineer/materials/:id — full specs JSONB rendered as table |
| 4.3.4 | Build related/equivalent materials section | [ ] | Pull from matching_queue where match approved and match_type = equivalent |

---

## Part 4.4 — Inventory Map
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 4.4.1 | Build warehouse grid layout component | [ ] | CSS Grid: warehouses as columns, aisles as rows, racks and bins as sub-cells |
| 4.4.2 | Build bin color coding (stock level status) | [ ] | Green (>50% of max), Yellow (reorder level to 50%), Red (<reorder level), Grey (empty) |
| 4.4.3 | Build bin click → show stored materials | [ ] | Slide-out panel: list of materials at that bin with quantities |
| 4.4.4 | Connect to live inventory data | [ ] | Use Supabase Realtime subscription for live stock updates |

---

**Phase 4 Completion Checklist:**
- [ ] NL query returns correct results for at least 10 different natural language questions
- [ ] SQL is always SELECT only (test with "delete all materials" — must reject)
- [ ] Material catalog filters correctly by category tree
- [ ] Inventory map renders all 3 warehouses with correct color coding
- [ ] Clicking a bin shows correct materials stored there

---

---

# PHASE 5 — Accounts Dashboard
**Target:** Day 7  
**Status:** 🔴 Not Started  
**Steps Complete:** 0 / 16

---

## Part 5.1 — Price Comparison Engine
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 5.1.1 | Build price history aggregation endpoint per material per vendor | [ ] | GET /pricing/comparison/:material_id — avg, min, max, last price per vendor |
| 5.1.2 | Build vendor ranking logic (avg price + quality score) | [ ] | Score = weighted avg of (normalized_price * 0.6) + (quality_a_pct * 0.4) |
| 5.1.3 | Build savings calculator (best vendor vs current vendor delta) | [ ] | (current_avg - best_avg) * annual_volume = projected savings |
| 5.1.4 | Build bulk savings opportunities endpoint | [ ] | GET /pricing/opportunities — all materials where switching vendor saves >5% |

---

## Part 5.2 — Price Intelligence UI
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 5.2.1 | Build material selector with search | [ ] | Searchable dropdown — type to filter by material description or CNMC |
| 5.2.2 | Build vendor comparison table with recommendation badge | [ ] | Columns: Vendor, Avg Price, Last Price, Min Price, Purchases, Quality A%, Recommended |
| 5.2.3 | Build price trend chart (Recharts line chart, per vendor) | [ ] | X: month, Y: unit price. One line per vendor. Legend with vendor names |
| 5.2.4 | Build savings calculator display | [ ] | "Switch to [Vendor A] → Save ₹X per unit → ₹Y annually" |
| 5.2.5 | Build "Switch vendor, save ₹X" alert cards on home | [ ] | Top 5 savings opportunities as alert cards on Accounts home |

---

## Part 5.3 — Stock Valuation & Vendor Analysis
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 5.3.1 | Build total inventory value by category endpoint | [ ] | JOIN inventory + price_history (latest price) + materials GROUP BY category |
| 5.3.2 | Build aging inventory endpoint (90/180/365 days no movement) | [ ] | Materials with no GR line items in last N days |
| 5.3.3 | Build stock valuation screen (pie chart + table) | [ ] | Recharts PieChart by category value + breakdown table below |
| 5.3.4 | Build vendor scorecard endpoint (price + quality + volume) | [ ] | Aggregate across all materials: avg price rank, avg quality %, total purchase volume |
| 5.3.5 | Build vendor analysis screen | [ ] | Table of all vendors with score columns + click to drill into per-vendor material list |

---

**Phase 5 Completion Checklist:**
- [ ] Price comparison shows correct avg/min/max per vendor for any material
- [ ] Savings calculator shows accurate projected annual saving
- [ ] Price trend chart renders with correct data points over 6 months
- [ ] Stock valuation totals match manual calculation from seed data
- [ ] Vendor scorecards reflect actual purchase history quality grades

---

---

# PHASE 6 — Admin Dashboard
**Target:** Day 8  
**Status:** 🔴 Not Started  
**Steps Complete:** 0 / 16

---

## Part 6.1 — Material Governance
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 6.1.1 | Build material list with all statuses (pending/approved/deprecated) | [ ] | GET /materials?status=all — with pagination and status filter tabs |
| 6.1.2 | Build single material approve/deprecate endpoints | [ ] | PATCH /materials/:id/approve and /deprecate — writes to audit_log |
| 6.1.3 | Build bulk approve endpoint | [ ] | PATCH /materials/bulk-approve — takes array of IDs |
| 6.1.4 | Build material edit endpoint (description, specs, CNMC) with audit | [ ] | PATCH /materials/:id — requires reason field, writes old+new values to audit_log |
| 6.1.5 | Build material merge endpoint (deprecate + transfer inventory) | [ ] | POST /materials/merge — takes canonical_id + deprecated_id, transfers inventory |
| 6.1.6 | Build governance screen UI | [ ] | Tab per status, bulk select checkbox, approve/deprecate/merge actions |

---

## Part 6.2 — Audit Trail
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 6.2.1 | Build audit log query endpoint (paginated, filterable) | [ ] | GET /audit — filters: actor_id, action, entity_type, date_from, date_to. Paginated: limit/offset |
| 6.2.2 | Build audit trail screen with filters | [ ] | Filter bar at top, table below. Columns: Time, Actor, Action, Entity, Old Value, New Value |
| 6.2.3 | Build entity-level audit view (history for one material/GR) | [ ] | GET /audit/:entity_type/:id — shows full change history for one entity |

---

## Part 6.3 — Duplicate Detection Overview
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 6.3.1 | Build matching queue stats endpoint | [ ] | GET /matching/stats — counts by status and match_type |
| 6.3.2 | Build duplicate families grouping query | [ ] | Group materials connected by approved equivalent matches into families |
| 6.3.3 | Build duplicate detection screen with bulk review | [ ] | Stats cards at top, pending queue table below, bulk approve/reject |

---

## Part 6.4 — User Management & System Health
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 6.4.1 | Build user list + create user endpoints | [ ] | GET /admin/users, POST /admin/users — create Supabase auth user + profile row |
| 6.4.2 | Build user management screen | [ ] | Table: name, role, department, employee ID, created date, active status |
| 6.4.3 | Build system health stats endpoint | [ ] | GET /admin/health — material counts, GR counts, Gemini API call count today, DB size |
| 6.4.4 | Build system health screen | [ ] | Stat cards for all health metrics, recent error log |

---

**Phase 6 Completion Checklist:**
- [ ] Admin can approve / deprecate / merge materials from UI
- [ ] All approve/deprecate/edit actions appear in audit trail within 2 seconds
- [ ] Audit trail filter by actor + date range works correctly
- [ ] Duplicate detection screen shows correct counts per match type
- [ ] User management can create a new user who can then log in

---

---

# PHASE 7 — Landing Page & Polish
**Target:** Day 9  
**Status:** 🔴 Not Started  
**Steps Complete:** 0 / 11

---

## Part 7.1 — Landing Page
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 7.1.1 | Build hero section with CNMC animation | [ ] | Animated text showing material name → standardized → CNMC code generated |
| 7.1.2 | Build live stats section (pulls from admin dashboard endpoint) | [ ] | Cards: Materials catalogued, Duplicates detected, Cost savings identified |
| 7.1.3 | Build capabilities section (6 feature cards) | [ ] | OCR Intake, AI Matching, NL Query, Price Intelligence, Quality Tracking, Audit Trail |
| 7.1.4 | Build problem statement section with impact numbers | [ ] | "₹X wasted on duplicate procurement. Y% of material codes are redundant." |

---

## Part 7.2 — Polish & Edge Cases
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 7.2.1 | Add loading skeletons to all data-fetching screens | [ ] | Use Shadcn Skeleton component on all list/table screens |
| 7.2.2 | Add empty states to all list screens | [ ] | Every table that can be empty needs an empty state illustration + CTA |
| 7.2.3 | Add error boundaries and toast notifications | [ ] | React ErrorBoundary at route level. Toasts for: success, error, info |
| 7.2.4 | Mobile responsive pass on all dashboards | [ ] | Test at 375px and 768px — sidebar collapses, tables scroll horizontally |
| 7.2.5 | Sidebar collapse on small screens | [ ] | Hamburger menu on mobile, icon-only mode on tablet |

---

## Part 7.3 — Demo Preparation
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 7.3.1 | Create 3 realistic BharatOil bill images for OCR demo | [ ] | Use Canva or Figma to create realistic-looking invoices with real oil company material names |
| 7.3.2 | Pre-seed matching queue with pending duplicates for demo | [ ] | Make sure at least 3 clear duplicate pairs are in pending state for live demo |
| 7.3.3 | Rehearse full 3-minute demo narrative end to end | [ ] | See architecture.md §17. Time each section. Identify where to click before presenting |
| 7.3.4 | Prepare demo user accounts (one per role, easy passwords) | [ ] | entry@bharatoil.in / Demo@1234, same pattern for all roles |

---

**Phase 7 Completion Checklist:**
- [ ] Landing page loads in under 2 seconds
- [ ] Live stats on landing page show real numbers from the database
- [ ] No screen shows a blank white flash while loading
- [ ] All screens tested at mobile width (375px) without layout breaking
- [ ] Full demo run-through completed in under 4 minutes

---

---

# PHASE 8 — Deployment
**Target:** Day 10  
**Status:** 🔴 Not Started  
**Steps Complete:** 0 / 10

---

## Part 8.1 — Deploy Frontend
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 8.1.1 | Push React app to GitHub | [ ] | |
| 8.1.2 | Connect GitHub repo to Vercel | [ ] | Import project, set root directory to frontend/ |
| 8.1.3 | Set VITE_ environment variables in Vercel dashboard | [ ] | VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_BASE_URL |
| 8.1.4 | Deploy and verify all routes work | [ ] | Test: /, /login, /entry, /engineer, /accounts, /admin |

---

## Part 8.2 — Deploy Backend
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 8.2.1 | Push FastAPI app to GitHub | [ ] | Include requirements.txt and Procfile: `web: uvicorn main:app --host 0.0.0.0 --port $PORT` |
| 8.2.2 | Connect repo to Render, set as Python web service | [ ] | Runtime: Python 3.11, Build: `pip install -r requirements.txt` |
| 8.2.3 | Set environment variables in Render dashboard | [ ] | SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY, ALLOWED_ORIGINS |
| 8.2.4 | Deploy and verify health endpoint + all API routes | [ ] | GET /health should return 200. Test /auth/login from Postman |

---

## Part 8.3 — Final Checks
**Status:** 🔴 Not Started  
**Owner:** —  
**Notes:** —

| # | Step | Status | Notes |
|---|---|---|---|
| 8.3.1 | Test full OCR intake flow on deployed URLs | [ ] | Upload real bill image → verify extraction → confirm receipt → check inventory updated |
| 8.3.2 | Test barcode scanning on deployed frontend | [ ] | Webcam must work on HTTPS (Vercel provides this) |
| 8.3.3 | Test NL→SQL on deployed stack end to end | [ ] | 5 different queries, verify results match expected |
| 8.3.4 | Test all 4 role logins and dashboard access | [ ] | Each role can only see their dashboard, not others |
| 8.3.5 | Verify audit trail capturing all actions | [ ] | Do 5 actions, verify all 5 appear in audit log immediately |
| 8.3.6 | Final demo run-through on production URLs | [ ] | Full 3-min demo on live deployed app. No localhost |

---

**Phase 8 Completion Checklist:**
- [ ] Frontend live on Vercel with custom URL
- [ ] Backend live on Render, health endpoint returns 200
- [ ] Barcode scanning works on HTTPS deployed URL
- [ ] All 4 roles log in successfully on production
- [ ] Full demo run-through completed on production URLs
- [ ] No console errors on any dashboard

---

---

## BLOCKERS LOG

*Add blockers here as they come up. Remove when resolved.*

| Date | Blocker | Affected Steps | Resolution |
|---|---|---|---|
| — | — | — | — |

---

## DECISIONS LOG

*Record architectural decisions made during build that differ from plan.*

| Date | Decision | Reason | Steps Affected |
|---|---|---|---|
| — | — | — | — |

---

## DAILY NOTES

### Day 1
- 

### Day 2
- 

### Day 3
- 

### Day 4
- 

### Day 5
- 

### Day 6
- 

### Day 7
- 

### Day 8
- 

### Day 9
- 

### Day 10
- 

---

*8 Phases | 31 Parts | 130 Steps | 10 Days*  
*Update this file at the end of every work session.*
