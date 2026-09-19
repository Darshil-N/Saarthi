# Saarthi — Fix Plan

**Created:** 2026-09-19 · **Source:** `audit.md` (65 findings) · **Steps:** 146 in 11 phases

This replaces the original build plan (still available in git history). Progress is tracked in `progress.md`; every step ID here has a row there.

## Working rules (apply to every step)

1. Nothing in the project is changed without the user's explicit go-ahead.
2. No database read or write without the user's approval, one action at a time.
3. plan.md (this file) and progress.md are kept current after every change.
4. Production-grade code quality.
5. No push to any remote without approval; local commits are fine.
6. Nothing is assumed — ask whenever a decision is ambiguous or work is stuck.

**Step flags:** 🔒 DB = touches the live database (needs approval per action) · ❓ Decision = needs a user decision first · 🗑 Delete = removes existing files/rows (needs approval) · 🌐 Quota = uses the Gemini free tier / external API

**Refs** are audit finding IDs from `audit.md`.

---

## Decisions Log

| ID | Status | Decision / question | Notes | Affects |
|---|---|---|---|---|
| D-1 | OPEN | Data-access pattern: send all reads and writes through FastAPI (audited, role-checked, one place for logic) or keep direct Supabase reads under RLS. | Recommended: FastAPI for all writes and anything needing audit or validation; direct Supabase reads only where RLS is verified sufficient. Needs your answer. | 0.2.1, Phases 5–7 |
| D-2 | DECIDED | Every dashboard reads real database data; no mock or random data in the app. | Stated by the user. | Phase 6, 8 |
| D-3 | DECIDED | One consistent dataset replaces the random seeds. | Stated by the user. | Phase 8 |
| D-4 | DECIDED (approach) | shrindhi/: user said 'whatever is convenient'. Approach: port what is useful (MaterialDetail layout), then remove the app. Removal still needs explicit approval at that time. | Chosen as the least-effort route that loses nothing. | 5.1.8, 9.1.2 |
| D-5 | DECIDED (partly open) | NL→SQL uses a real Gemini call within free-tier limits; Ollama with Mistral or DeepSeek as demo fallback. | Open: Ollama runs on a local machine, so a hosted (Render) demo cannot reach it unless it is tunnelled or hosted elsewhere. Needs your answer before 4.1.1. | Phase 4 |
| D-6 | PROPOSED | OCR becomes a read-only draft; materials, matches, inventory and price history are created in one transaction only when the receipt is confirmed. New materials start as 'pending'. | Fixes E2, E3, E4, E5 together. Needs your approval before 3.1.4 and 1.2.2. INTERIM (implemented 2026-09-19, no DB change): confirm now validates, books stock and writes price history in Python with undo-on-failure, and OCR still creates pending materials. Exact matches above the confidence threshold no longer create duplicates. The full redesign (read-only OCR draft, DB transaction) is still pending your approval. | 3.1.4, 1.2.2, 3.3.1 |
| D-7 | OPEN | Approval authority: which roles may approve materials and mappings (currently entry operator, engineer and admin). | Needs your answer before 2.1.6. | 2.1.6 |
| D-8 | OPEN | Engineer visibility of pending materials, and whether the Entry 'Locations' page is built or hidden. | Needs your answer before 5.1.2 and 3.4.12. | 5.1.2, 3.4.12 |

---

## Phase 0 — Governance, Decisions & Live-DB Baseline

*Everything that must be settled before code changes begin.*

### Part 0.1 — Audit and project records

- **0.1.1** Complete full-codebase audit _(refs: P1)_ — Backend, main frontend, a_p, shrindhi, schema, seeds reviewed.
- **0.1.2** Write audit.md (65 findings, evidence level per finding)
- **0.1.3** Rewrite plan.md and progress.md as a bug-by-bug fix plan _(refs: P1)_ — Old build plan remains in git history.
- **0.1.4** Record working rules and product decisions in assistant memory

### Part 0.2 — Decisions and housekeeping

- **0.2.1** Decide data-access pattern: FastAPI for everything vs. direct Supabase for reads _(refs: Q5 · ❓ Decision)_ — Open. See Decisions Log D-1.
- **0.2.2** Approve the order of the fix phases in this plan _(❓ Decision)_ — Approved by the user on 2026-09-19.
- **0.2.3** Commit the existing uncommitted working tree locally (12 modified files + seed_demo_data.py) _(refs: Q4 · ❓ Decision)_ — Local commit 5cedcce; nothing pushed.

### Part 0.3 — Live-database baseline (read-only, one approval per action)

- **0.3.1** Check whether public sign-up is enabled in Supabase Auth _(refs: D2 · 🔒 DB)_
- **0.3.2** List live RLS policies on profiles _(refs: D1 · 🔒 DB)_
- **0.3.3** Check anon/authenticated grants on views and RPCs, and view security_invoker setting _(refs: D3 · 🔒 DB)_
- **0.3.4** Check whether inventory is in the supabase_realtime publication _(refs: G5 · 🔒 DB)_
- **0.3.5** Inspect vector index definition and test candidate recall _(refs: D4 · 🔒 DB)_
- **0.3.6** Capture per-table row counts as the baseline for the dataset work _(🔒 DB)_

---

## Phase 1 — Database Security & Schema Fixes

*Close the privilege-escalation and RLS holes and add the database functions later phases depend on. All SQL is written as reviewable migration files first; nothing is applied without approval, one statement group at a time.*

### Part 1.1 — Access control

- **1.1.1** Restrict profiles self-update so role and is_active cannot be changed by the user _(refs: D1 · 🔒 DB)_
- **1.1.2** Remove or constrain profiles_insert_self _(refs: D1 · 🔒 DB)_
- **1.1.3** Make handle_new_user ignore metadata role; default to least privilege _(refs: D2 · 🔒 DB)_
- **1.1.4** Make views security_invoker (or grant explicitly) so RLS applies _(refs: D3 · 🔒 DB)_
- **1.1.5** Revoke blanket anon grants on tables, views and routines; grant only what is needed _(refs: D3 · 🔒 DB)_
- **1.1.6** Add SET search_path to all SECURITY DEFINER functions _(refs: D3 · 🔒 DB)_

### Part 1.2 — Migrations and schema alignment

- **1.2.1** Create a migrations/ folder; remove the duplicate schema.sql copy; document how to apply _(refs: D5 · 🗑 Delete)_ — Deleting one of the two identical copies needs approval.
- **1.2.2** Confirm_receipt RPC: one transaction creating GR, lines, new materials, inventory upsert, price_history and audit rows _(refs: E2, E3, E5, E6, A7 · 🔒 DB)_
- **1.2.3** approve_mapping RPC: merge stock, repoint references, deprecate duplicate, audit _(refs: E12 · 🔒 DB)_
- **1.2.4** Read-only NL-query executor (restricted role or RPC with statement timeout, allow-listed views) _(refs: G1 · 🔒 DB)_
- **1.2.5** Aggregate RPCs/views for Accounts: price comparison, savings opportunities, valuation (latest price), aging, vendor scorecard, purchase history _(refs: C1, C3, B8 · 🔒 DB)_
- **1.2.6** Admin RPCs: dashboard stats, matching-queue stats, system-health metrics _(refs: M5, M6, B8 · 🔒 DB)_
- **1.2.7** Add inventory to the realtime publication (if the map keeps its Live claim) _(refs: G5 · 🔒 DB ❓ Decision)_
- **1.2.8** Rebuild vector index for the real data size (HNSW or ivfflat with suitable lists/probes) _(refs: D4 · 🔒 DB)_

---

## Phase 2 — Backend Foundation

*Correct, secure, observable API layer.*

### Part 2.1 — Auth and access control

- **2.1.1** Shared Supabase client and cached token verification (remove per-request client creation) _(refs: B5)_ — Shared client + token cache implemented and unit-tested with fakes; not yet run against real Supabase Auth.
- **2.1.2** Reject users with no profile or is_active = false; remove role defaults _(refs: B4)_ — No profile / deactivated user -> 403 (previously crashed with a 500 or silently became entry_operator). Unit-tested.
- **2.1.3** Real logout that revokes the user's session _(refs: B3)_ — Logout revokes the session (admin.sign_out) and clears the cache; unit-tested with a fake. Real revoke not exercised; the UI logout button does not call /auth/logout yet (9.1.3).
- **2.1.4** Return generic auth errors; log details server-side _(refs: B6)_ — Login/verification errors are generic; details are logged. Unit-tested.
- **2.1.5** Enforce role checks on every endpoint (including /intake/confirm and /intake/barcode) _(refs: B1)_ — Role checks added to /intake/ocr, /confirm, /barcode. Review endpoints keep their roles pending D-7; read endpoints stay open to any signed-in role (matches RLS).
- **2.1.6** Decide and implement the approval-authority matrix (who may approve materials / mappings) _(refs: B10 · ❓ Decision)_
- **2.1.7** Replace .single() with maybe_single() and proper 404 handling _(refs: B2)_ — Every .single() in the backend replaced by maybe_single() with 404 handling; malformed ids give 404.

### Part 2.2 — Reliability and hygiene

- **2.2.1** Structured logging and a global exception handler with request IDs (replace print) _(refs: B7, A7)_ — Request-ID logging; unhandled errors return a JSON 500 that still carries CORS headers; print() removed. Tested.
- **2.2.2** Dashboard stats: UTC-correct 'today', surface errors instead of returning 0 _(refs: B7)_ — 'Today' uses the business day (IST offset configurable); failures return 502 instead of zeros. The Home page shows the error.
- **2.2.3** Run blocking SDK calls (Gemini, Supabase) off the event loop _(refs: A3)_ — Sync endpoints run in the thread pool; Gemini and Supabase calls inside async code use asyncio.to_thread.
- **2.2.4** Config cleanup: drop unused JWT_SECRET / python-jose; add google-genai; pin and document deps _(refs: B9, A5)_ — Removed unused JWT_SECRET and python-jose; model names/thresholds/limits are now settings. Not done: add google-genai (needed with 3.2.3).
- **2.2.5** Remove dead code (mismatched models, unused prompts, broken match_materials_rpc.sql) _(refs: B9 · 🗑 Delete)_ — File deletions need approval.
- **2.2.6** Bounds and pagination limits on all list endpoints _(refs: B8)_ — limit/offset bounds on materials, inventory and receipts.
- **2.2.7** pytest scaffold with mocked Supabase and Gemini; first tests for auth and role checks _(refs: Q3)_ — 146 pytest tests with an in-memory fake Supabase (Arpit_Backend/tests). Run: venv\Scripts\python -m pytest

---

## Phase 3 — Intake Pipeline (OCR, Barcode, Confirm, Matching)

*A scanned bill can be reviewed and confirmed end to end, and confirming really updates stock, prices, matches and the audit trail.*

### Part 3.1 — OCR service

- **3.1.1** Robust JSON extraction (fence-tolerant, request JSON mime type) _(refs: A1 · 🌐 Quota)_ — Fence-tolerant JSON extraction done and tested. Deliberately not done: forcing a JSON mime type, which cannot be tested without calling the live model.
- **3.1.2** Distinguish 'unreadable bill' from quota/network errors in the API response _(refs: A1)_ — Unreadable bill -> 422, quota -> 429, AI outage -> 502; Gemini exception mapping tested with the real exception classes.
- **3.1.3** Validate and coerce OCR fields (null/strings/units) before use _(refs: A2)_ — Numbers, units, ids and grades are normalised; junk rows are dropped instead of crashing. Tested.
- **3.1.4** Make OCR a read-only draft: no materials, queue rows or audit rows before confirm _(refs: E4, E5, A7 · ❓ Decision)_ — Design change proposed in Decisions Log D-6.
- **3.1.5** Signed URLs for the private bill-images bucket; correct file extension per type _(refs: A8)_ — Bills stored as paths in the private bucket; signed URLs on read; extension per type. Tested with fake storage; real Storage API not exercised.
- **3.1.6** Upload type/size validation with clear errors _(refs: E14, A8)_ — Type/size validation (415/413/422) in the API and in the upload dropzone.

### Part 3.2 — Matching and CNMC

- **3.2.1** Batch embeddings and parallelise per-line work; run post-confirm matching as a BackgroundTask _(refs: A3 · 🌐 Quota)_
- **3.2.2** Use configured similarity thresholds; implement auto-resolve for high-confidence exact matches _(refs: A4)_ — Exact matches above SIMILARITY_EXACT link to the catalog without creating a pending duplicate (tested with a fake AI). Live-model behaviour not yet observed.
- **3.2.3** Align stored and runtime embedding text and task type; re-embed materials _(refs: A5 · 🔒 DB 🌐 Quota)_ — Re-embedding writes to the database and uses Gemini quota.
- **3.2.4** Centralise model names in config (no floating alias in code) _(refs: A6)_ — Model names, embedding model/dimensions and thresholds come from settings.
- **3.2.5** Guard CNMC generation with a deterministic fallback; uniqueness enforced at confirm time _(refs: A2, E5)_ — Deterministic MISC-GEN fallback when Gemini fails (tested). CNMC uniqueness is still enforced at OCR time, not at confirm time.
- **3.2.6** Match new lines of the same bill against each other _(refs: E5)_

### Part 3.3 — Confirm and receipts API

- **3.3.1** POST /intake/confirm calls the transactional RPC; returns GR number and totals _(refs: E2, E3, E6)_ — Implemented in Python instead of a DB function: validate, save, book stock (optimistic concurrency), price history, audit, and undo everything on any failure. Verified against a fake PostgREST and a browser run; real database not yet exercised. The RPC in 1.2.2 is still the route to a true transaction.
- **3.3.2** Server-side validation: date default, quantity > 0, location exists, quality in A/B/C _(refs: E1, E3)_ — Date, quantity > 0, price >= 0, grade A/B/C, vendor, locations, materials and line links are validated before anything is written; all problems are reported together.
- **3.3.3** Idempotency key to prevent double-submit creating two receipts _(refs: E3)_ — Idempotent per client_draft_id (tested). Two simultaneous requests with the same id could both pass the check; a unique index (DB change) would close that.
- **3.3.4** GET /intake/receipts with vendor/status/date filters, gr_number, vendor name, total _(refs: E9, E10)_ — Filters, gr_number, vendor name, total (tested against a fake PostgREST; live query syntax not yet exercised).
- **3.3.5** GET /intake/receipts/{id} with line items and material details _(refs: E8)_ — Header + lines + material info + signed bill URL (tested against a fake PostgREST; live query not yet exercised).
- **3.3.6** Approve/reject mapping endpoints use the RPC, require status = pending, write audit _(refs: E12)_ — Only pending matches can be reviewed (409 otherwise); update is compare-and-set; audit written. Merging stock / deprecating the duplicate still needs the approve_mapping RPC (1.2.3).

### Part 3.4 — Intake UI

- **3.4.1** Default receipt date to today; validate before submit with inline errors _(refs: E1)_ — Date defaults to today, is required before OCR and Confirm, inline error. Browser-verified (Edge) against the real backend code + fake database.
- **3.4.2** Show real backend error messages in toasts _(refs: E1)_ — Backend messages shown in toasts (422 lists, plain details, network errors). Browser-verified.
- **3.4.3** After confirm: show GR number and navigate to the receipt detail _(refs: E1, E10)_ — Toast with GR number and item count; browser opens the saved receipt in Receipt History. Browser-verified.
- **3.4.4** Recompute line totals on edit; guard NaN; require quantity > 0 _(refs: E7)_ — Numeric fields never become NaN, totals follow edits, incomplete rows are highlighted, the draft is validated before sending. Browser-verified.
- **3.4.5** Send edited description/CNMC in the confirm payload and honour it server-side _(refs: E6)_ — Description edits are saved (as the bill text). CNMC is now read-only because the server does not persist CNMC edits. Incomplete until edits update the pending material.
- **3.4.6** Cancel without page reload; clear file state; discard the draft cleanly _(refs: E4, E14)_ — Cancel resets the draft without reloading and clears the file. Pending materials created during OCR remain in the database (E4) until D-6.
- **3.4.7** Receipt History: working filters, correct status values, detail panel with its own state _(refs: E8, E9, E10)_ — Filters sent to the API, correct status values, detail panel with own state and error handling. Browser-verified.
- **3.4.8** Home page: open the clicked receipt via ?id; fix status colour map _(refs: E9, E11)_ — Home opens the clicked receipt via ?id; GR numbers and status colours fixed. Browser-verified.
- **3.4.9** Pending Approvals: error toasts and result summary after approve/reject _(refs: E12)_ — Success/error toasts added (including 'already reviewed'); not exercised in a browser because the test fake has no matching-queue view.
- **3.4.10** Barcode tab: location dropdown, shared vendor/date header, stable onDecode, real new-material path _(refs: E13)_ — Done: stable camera handler, one lookup per scan, location dropdown, shared header, scanned-items list, honest not-in-catalog message. Not done: creating a new material from an unknown barcode. Camera scanning cannot be tested headless.
- **3.4.11** Separate OCR and barcode draft state _(refs: E14)_
- **3.4.12** Locations page: implement a real read-only list, or hide the menu item _(refs: E15 · ❓ Decision)_

---

## Phase 4 — Natural-Language Query (real Gemini)

*Engineer questions are answered by a real model-generated, validated, read-only SQL query, within free-tier limits.*

### Part 4.1 — NL→SQL service

- **4.1.1** LLM provider abstraction: Gemini by default; Ollama (Mistral or DeepSeek) as demo fallback _(refs: G1 · ❓ Decision)_ — Deployed-demo hosting of Ollama is an open question (D-5).
- **4.1.2** Schema-aware prompt limited to approved views with column descriptions and examples _(refs: G1 · 🌐 Quota)_
- **4.1.3** SQL safety validator: single SELECT, allow-listed views, forced LIMIT, no functions/comments _(refs: G1)_
- **4.1.4** Executor uses the read-only role/RPC with a statement timeout _(refs: G1)_
- **4.1.5** Free-tier protection: per-user rate limit, result cache, daily request budget, graceful fallback _(refs: G1 · 🌐 Quota)_
- **4.1.6** Log every query with provider, latency, success/error into nl_query_log _(refs: G4, G1 · 🔒 DB)_ — Writes rows at runtime via the app.
- **4.1.7** User-friendly error and no-result handling _(refs: G1)_

### Part 4.2 — NL query UI

- **4.2.1** Fix API base URL usage (single API client, no optional-chained import.meta.env) _(refs: G2)_
- **4.2.2** Show real phases and the provider that answered; remove the fake 'Generating SQL with Gemini' text _(refs: G1)_
- **4.2.3** Persistent query history loaded from nl_query_log; remove the client-side insert _(refs: G4)_

---

## Phase 5 — Engineer Dashboard

*Every engineer screen shows correct, live database content.*

### Part 5.1 — Home, map, catalog, detail

- **5.1.1** Engineer Home: correct columns, low-stock from v_low_stock_alerts / reorder levels _(refs: G3)_
- **5.1.2** Decide whether engineers may see pending materials (RLS) or the KPIs are relabelled _(refs: G7 · ❓ Decision)_
- **5.1.3** Inventory map built from locations (empty bins shown) joined with inventory _(refs: G5)_
- **5.1.4** Bin colours from each row's reorder_level and max_stock _(refs: G5)_
- **5.1.5** Realtime updates working, or remove the 'Live' label _(refs: G5 · ❓ Decision)_
- **5.1.6** Catalog category tree loaded from the database (matches CNMC tree, includes CIVIL) _(refs: G6)_
- **5.1.7** Real debounce, page reset on search, safe escaping of search text _(refs: G6)_
- **5.1.8** Material detail route: specs, inventory by bin, price history _(refs: G6)_ — May reuse the layout of shrindhi MaterialDetail (D-4).
- **5.1.9** Equivalent materials via an access-safe RPC, both directions _(refs: G6, G7)_

---

## Phase 6 — Accounts Dashboard on Real Data

*Price intelligence, valuation and vendor analysis computed from real receipts and price history.*

### Part 6.1 — API

- **6.1.1** Price comparison per material per vendor endpoint _(refs: C1, B8)_
- **6.1.2** Vendor ranking and savings calculation _(refs: C1)_
- **6.1.3** Savings opportunities endpoint _(refs: C1)_
- **6.1.4** Stock valuation by category using the latest price _(refs: C1, C3)_
- **6.1.5** Aging inventory endpoint (90/180/365 days) _(refs: C1)_
- **6.1.6** Vendor scorecard endpoint (price, quality, volume) _(refs: C1)_
- **6.1.7** Purchase history endpoint with filters and pagination _(refs: C1)_

### Part 6.2 — UI

- **6.2.1** Accounts Home from real endpoints _(refs: C1)_
- **6.2.2** Price Intelligence from real endpoints _(refs: C1)_
- **6.2.3** Stock Valuation from real endpoints (real locations) _(refs: C1, C2)_
- **6.2.4** Vendor Analysis from real endpoints _(refs: C1)_
- **6.2.5** Purchase History from real endpoints _(refs: C1)_
- **6.2.6** Delete mockAccountsData.js and its utilities _(refs: C2 · 🗑 Delete)_
- **6.2.7** Loading, empty and error states on all Accounts pages _(refs: C1)_

---

## Phase 7 — Admin Dashboard

*Governance, audit, duplicates, users and health are real, audited and correct.*

### Part 7.1 — Material governance

- **7.1.1** Backend endpoints: approve, deprecate, bulk, edit, merge — each with audit, approved_by/at, deprecated_* fields _(refs: M4, B8)_
- **7.1.2** Governance UI calls the backend; confirmation dialogs for bulk actions _(refs: M4)_
- **7.1.3** Server-side pagination and safe search _(refs: M4)_

### Part 7.2 — Audit trail

- **7.2.1** Audit query endpoint (paginated; filters: actor, action, entity, date range) _(refs: M2, M7, B8)_
- **7.2.2** Audit UI: correct columns, action/entity values from the data, date filter, actor names, escaped CSV _(refs: M2, M7)_

### Part 7.3 — Duplicate detection

- **7.3.1** Matching stats endpoint and queue listing with correct columns/statuses _(refs: M1, B8)_
- **7.3.2** Merge / reject actions via the approve_mapping RPC with audit _(refs: M1)_
- **7.3.3** Duplicate detection UI rewired to the new endpoints _(refs: M1)_

### Part 7.4 — Users and system health

- **7.4.1** Admin-only create-user endpoint (auth user + profile) and role change with audit _(refs: M3, B8)_
- **7.4.2** User list with correct columns; prevent self-deactivation; enforce is_active _(refs: M3, B4)_
- **7.4.3** System health: real DB, Gemini/Ollama status, recent errors, table sizes _(refs: M6)_
- **7.4.4** Admin Home KPIs computed correctly (duplicates, data quality) _(refs: M5)_

---

## Phase 8 — One Consistent Dataset

*A single coherent demo dataset in the real database, replacing random seeds.*

### Part 8.1 — Design and script

- **8.1.1** Write the dataset specification for review (vendors, locations, materials, receipts, price history, matches, audit) _(❓ Decision)_
- **8.1.2** Idempotent seed script where inventory, price_history and audit rows are derived from the receipts
- **8.1.3** Dry-run mode that prints what would change without contacting the database
- **8.1.4** Remove the random seed_demo_data.py after replacement _(🗑 Delete)_
- **8.1.5** Demo bill images generated from the dataset's own materials and vendors

### Part 8.2 — Apply to the database (one approval per action)

- **8.2.1** Plan cleanup of existing random demo rows (list exactly what will be removed) _(🔒 DB 🗑 Delete)_
- **8.2.2** Apply cleanup _(🔒 DB 🗑 Delete)_
- **8.2.3** Apply dataset _(🔒 DB)_
- **8.2.4** Generate embeddings for the dataset (quota-aware) _(refs: A5 · 🔒 DB 🌐 Quota)_
- **8.2.5** Run consistency verification queries (inventory = receipts, prices = lines, etc.) _(🔒 DB)_
- **8.2.6** Reset demo account passwords _(refs: S3 · 🔒 DB)_

---

## Phase 9 — Frontend Structure, Session & Quality

*One coherent, testable, deployable frontend.*

### Part 9.1 — Structure and session

- **9.1.1** Move a_p/ pages into arya_frontend/src and fix imports (no cross-tree imports) _(refs: Q1)_
- **9.1.2** shrindhi/: port anything still needed (MaterialDetail layout), then remove the app _(refs: Q2 · ❓ Decision 🗑 Delete)_ — Decision D-4; removal needs approval.
- **9.1.3** Single API client with token refresh and 401 handling _(refs: S1)_
- **9.1.4** Use Supabase session state (listener) instead of the mock_auth copy; document token-storage choice _(refs: S1, S2)_
- **9.1.5** Login: real full name from profile; correct placeholder _(refs: S3)_
- **9.1.6** Landing page: live stats from the database; remove unverifiable claims _(refs: L1)_

### Part 9.2 — Quality

- **9.2.1** ESLint config and a clean lint run _(refs: Q3)_
- **9.2.2** Route-level code splitting _(refs: Q3)_
- **9.2.3** Frontend tests (Vitest + Testing Library) for intake, auth and approvals _(refs: Q3)_
- **9.2.4** README, env documentation, remove stray files and the empty root lockfile _(refs: Q5 · 🗑 Delete)_
- **9.2.5** Consistent toast/error handling across pages _(refs: E1, M4)_

---

## Phase 10 — Verification & Deployment

*Prove every audit finding is closed, then ship.*

### Part 10.1 — Verification

- **10.1.1** Regression pass: re-test every audit ID and record the result in progress.md
- **10.1.2** End-to-end run for all 4 roles on real data
- **10.1.3** Mobile-width pass on all dashboards
- **10.1.4** Free-tier stress check of OCR + NL query flows _(🌐 Quota)_

### Part 10.2 — Deployment (nothing is pushed without approval)

- **10.2.1** Frontend deployment config and env vars _(refs: Q1 · ❓ Decision)_
- **10.2.2** Backend deployment config and env vars; health endpoint _(❓ Decision)_
- **10.2.3** Push to GitHub _(❓ Decision)_ — Only with explicit approval.
- **10.2.4** Production smoke test and final demo rehearsal

---

## Audit coverage

Every audit finding is mapped to at least one step:

| Finding | Steps |
|---|---|
| E1 | 3.3.2, 3.4.1, 3.4.2, 3.4.3, 9.2.5 |
| E2 | 1.2.2, 3.3.1 |
| E3 | 1.2.2, 3.3.1, 3.3.2, 3.3.3 |
| E4 | 3.1.4, 3.4.6 |
| E5 | 1.2.2, 3.1.4, 3.2.5, 3.2.6 |
| E6 | 1.2.2, 3.3.1, 3.4.5 |
| E7 | 3.4.4 |
| E8 | 3.3.5, 3.4.7 |
| E9 | 3.3.4, 3.4.7, 3.4.8 |
| E10 | 3.3.4, 3.4.3, 3.4.7 |
| E11 | 3.4.8 |
| E12 | 1.2.3, 3.3.6, 3.4.9 |
| E13 | 3.4.10 |
| E14 | 3.1.6, 3.4.6, 3.4.11 |
| E15 | 3.4.12 |
| B1 | 2.1.5 |
| B2 | 2.1.7 |
| B3 | 2.1.3 |
| B4 | 2.1.2, 7.4.2 |
| B5 | 2.1.1 |
| B6 | 2.1.4 |
| B7 | 2.2.1, 2.2.2 |
| B8 | 1.2.5, 1.2.6, 2.2.6, 6.1.1, 7.1.1, 7.2.1, 7.3.1, 7.4.1 |
| B9 | 2.2.4, 2.2.5 |
| B10 | 2.1.6 |
| A1 | 3.1.1, 3.1.2 |
| A2 | 3.1.3, 3.2.5 |
| A3 | 2.2.3, 3.2.1 |
| A4 | 3.2.2 |
| A5 | 2.2.4, 3.2.3, 8.2.4 |
| A6 | 3.2.4 |
| A7 | 1.2.2, 2.2.1, 3.1.4 |
| A8 | 3.1.5, 3.1.6 |
| G1 | 1.2.4, 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5, 4.1.6, 4.1.7, 4.2.2 |
| G2 | 4.2.1 |
| G3 | 5.1.1 |
| G4 | 4.1.6, 4.2.3 |
| G5 | 0.3.4, 1.2.7, 5.1.3, 5.1.4, 5.1.5 |
| G6 | 5.1.6, 5.1.7, 5.1.8, 5.1.9 |
| G7 | 5.1.2, 5.1.9 |
| C1 | 1.2.5, 6.1.1, 6.1.2, 6.1.3, 6.1.4, 6.1.5, 6.1.6, 6.1.7, 6.2.1, 6.2.2, 6.2.3, 6.2.4, 6.2.5, 6.2.7 |
| C2 | 6.2.3, 6.2.6 |
| C3 | 1.2.5, 6.1.4 |
| M1 | 7.3.1, 7.3.2, 7.3.3 |
| M2 | 7.2.1, 7.2.2 |
| M3 | 7.4.1, 7.4.2 |
| M4 | 7.1.1, 7.1.2, 7.1.3, 9.2.5 |
| M5 | 1.2.6, 7.4.4 |
| M6 | 1.2.6, 7.4.3 |
| M7 | 7.2.1, 7.2.2 |
| D1 | 0.3.2, 1.1.1, 1.1.2 |
| D2 | 0.3.1, 1.1.3 |
| D3 | 0.3.3, 1.1.4, 1.1.5, 1.1.6 |
| D4 | 0.3.5, 1.2.8 |
| D5 | 1.2.1 |
| S1 | 9.1.3, 9.1.4 |
| S2 | 9.1.4 |
| S3 | 8.2.6, 9.1.5 |
| Q1 | 9.1.1, 10.2.1 |
| Q2 | 9.1.2 |
| Q3 | 2.2.7, 9.2.1, 9.2.2, 9.2.3 |
| Q4 | 0.2.3 |
| Q5 | 0.2.1, 9.2.4 |
| L1 | 9.1.6 |
| P1 | 0.1.1, 0.1.3 |

*11 phases · 146 steps · 65 audit findings*
