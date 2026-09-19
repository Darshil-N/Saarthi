# Saarthi — Progress Tracker

**Last updated:** 2026-09-19 — intake pipeline fixed end to end and verified against fakes (146 backend tests + 27 browser checks); awaiting manual test on the real stack
**Overall:** 25 / 146 steps complete
**Status:** 🟡 In progress — Phase 2 and most of Phase 3 done; decisions D-1, D-5, D-6, D-7, D-8 still open

## How to use this file

- Update the status of a step the moment it changes; add what changed under Notes.
- `[ ]` not started · `[~]` coded but not finished, or coded and tested only against fakes and still needing a live run (the note says which) · `[x]` done and verified by an automated run · `[!]` blocked (say why) · `[-]` skipped (say why)
- A step is only `[x]` when it has been verified by running it (unit tests or a browser run), not when the code is written. Steps whose own logic calls the real Supabase or Gemini services stay `[~]` until they have run against the live services.
- Flags: 🔒 DB (approval per action) · ❓ Decision · 🗑 Delete (approval) · 🌐 Quota
- Refresh the counts and *Last updated* after every session. Log blockers in the Blockers table immediately.

## Phase summary

| Phase | Name | Done | Status |
|---|---|---|---|
| 0 | Governance, Decisions & Live-DB Baseline | 6 / 13 | 🟡 In progress |
| 1 | Database Security & Schema Fixes | 0 / 14 | ⚪ Not started |
| 2 | Backend Foundation | 8 / 14 | 🟡 In progress |
| 3 | Intake Pipeline (OCR, Barcode, Confirm, Matching) | 11 / 30 | 🟡 In progress |
| 4 | Natural-Language Query (real Gemini) | 0 / 10 | ⚪ Not started |
| 5 | Engineer Dashboard | 0 / 9 | ⚪ Not started |
| 6 | Accounts Dashboard on Real Data | 0 / 14 | ⚪ Not started |
| 7 | Admin Dashboard | 0 / 12 | ⚪ Not started |
| 8 | One Consistent Dataset | 0 / 11 | ⚪ Not started |
| 9 | Frontend Structure, Session & Quality | 0 / 11 | ⚪ Not started |
| 10 | Verification & Deployment | 0 / 8 | ⚪ Not started |

---

# Phase 0 — Governance, Decisions & Live-DB Baseline
**Steps complete:** 6 / 13

## Part 0.1 — Audit and project records  (4 / 4)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 0.1.1 | Complete full-codebase audit | [x] | P1 |  | Backend, main frontend, a_p, shrindhi, schema, seeds reviewed. |
| 0.1.2 | Write audit.md (65 findings, evidence level per finding) | [x] |  |  |  |
| 0.1.3 | Rewrite plan.md and progress.md as a bug-by-bug fix plan | [x] | P1 |  | Old build plan remains in git history. |
| 0.1.4 | Record working rules and product decisions in assistant memory | [x] |  |  |  |

## Part 0.2 — Decisions and housekeeping  (2 / 3)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 0.2.1 | Decide data-access pattern: FastAPI for everything vs. direct Supabase for reads | [ ] | Q5 | ❓ Decision | Open. See Decisions Log D-1. |
| 0.2.2 | Approve the order of the fix phases in this plan | [x] |  | ❓ Decision | Approved by the user on 2026-09-19. |
| 0.2.3 | Commit the existing uncommitted working tree locally (12 modified files + seed_demo_data.py) | [x] | Q4 | ❓ Decision | Local commit 5cedcce; nothing pushed. |

## Part 0.3 — Live-database baseline (read-only, one approval per action)  (0 / 6)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 0.3.1 | Check whether public sign-up is enabled in Supabase Auth | [ ] | D2 | 🔒 DB |  |
| 0.3.2 | List live RLS policies on profiles | [ ] | D1 | 🔒 DB |  |
| 0.3.3 | Check anon/authenticated grants on views and RPCs, and view security_invoker setting | [ ] | D3 | 🔒 DB |  |
| 0.3.4 | Check whether inventory is in the supabase_realtime publication | [ ] | G5 | 🔒 DB |  |
| 0.3.5 | Inspect vector index definition and test candidate recall | [ ] | D4 | 🔒 DB |  |
| 0.3.6 | Capture per-table row counts as the baseline for the dataset work | [ ] |  | 🔒 DB |  |

---

# Phase 1 — Database Security & Schema Fixes
**Steps complete:** 0 / 14

## Part 1.1 — Access control  (0 / 6)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 1.1.1 | Restrict profiles self-update so role and is_active cannot be changed by the user | [ ] | D1 | 🔒 DB |  |
| 1.1.2 | Remove or constrain profiles_insert_self | [ ] | D1 | 🔒 DB |  |
| 1.1.3 | Make handle_new_user ignore metadata role; default to least privilege | [ ] | D2 | 🔒 DB |  |
| 1.1.4 | Make views security_invoker (or grant explicitly) so RLS applies | [ ] | D3 | 🔒 DB |  |
| 1.1.5 | Revoke blanket anon grants on tables, views and routines; grant only what is needed | [ ] | D3 | 🔒 DB |  |
| 1.1.6 | Add SET search_path to all SECURITY DEFINER functions | [ ] | D3 | 🔒 DB |  |

## Part 1.2 — Migrations and schema alignment  (0 / 8)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 1.2.1 | Create a migrations/ folder; remove the duplicate schema.sql copy; document how to apply | [ ] | D5 | 🗑 Delete | Deleting one of the two identical copies needs approval. |
| 1.2.2 | Confirm_receipt RPC: one transaction creating GR, lines, new materials, inventory upsert, price_history and audit rows | [ ] | E2, E3, E5, E6, A7 | 🔒 DB |  |
| 1.2.3 | approve_mapping RPC: merge stock, repoint references, deprecate duplicate, audit | [ ] | E12 | 🔒 DB |  |
| 1.2.4 | Read-only NL-query executor (restricted role or RPC with statement timeout, allow-listed views) | [ ] | G1 | 🔒 DB |  |
| 1.2.5 | Aggregate RPCs/views for Accounts: price comparison, savings opportunities, valuation (latest price), aging, vendor scorecard, purchase history | [ ] | C1, C3, B8 | 🔒 DB |  |
| 1.2.6 | Admin RPCs: dashboard stats, matching-queue stats, system-health metrics | [ ] | M5, M6, B8 | 🔒 DB |  |
| 1.2.7 | Add inventory to the realtime publication (if the map keeps its Live claim) | [ ] | G5 | 🔒 DB ❓ Decision |  |
| 1.2.8 | Rebuild vector index for the real data size (HNSW or ivfflat with suitable lists/probes) | [ ] | D4 | 🔒 DB |  |

---

# Phase 2 — Backend Foundation
**Steps complete:** 8 / 14

## Part 2.1 — Auth and access control  (3 / 7)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 2.1.1 | Shared Supabase client and cached token verification (remove per-request client creation) | [~] | B5 |  | Shared client + token cache implemented and unit-tested with fakes; not yet run against real Supabase Auth. |
| 2.1.2 | Reject users with no profile or is_active = false; remove role defaults | [x] | B4 |  | No profile / deactivated user -> 403 (previously crashed with a 500 or silently became entry_operator). Unit-tested. |
| 2.1.3 | Real logout that revokes the user's session | [~] | B3 |  | Logout revokes the session (admin.sign_out) and clears the cache; unit-tested with a fake. Real revoke not exercised; the UI logout button does not call /auth/logout yet (9.1.3). |
| 2.1.4 | Return generic auth errors; log details server-side | [x] | B6 |  | Login/verification errors are generic; details are logged. Unit-tested. |
| 2.1.5 | Enforce role checks on every endpoint (including /intake/confirm and /intake/barcode) | [~] | B1 |  | Role checks added to /intake/ocr, /confirm, /barcode. Review endpoints keep their roles pending D-7; read endpoints stay open to any signed-in role (matches RLS). |
| 2.1.6 | Decide and implement the approval-authority matrix (who may approve materials / mappings) | [ ] | B10 | ❓ Decision |  |
| 2.1.7 | Replace .single() with maybe_single() and proper 404 handling | [x] | B2 |  | Every .single() in the backend replaced by maybe_single() with 404 handling; malformed ids give 404. |

## Part 2.2 — Reliability and hygiene  (5 / 7)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 2.2.1 | Structured logging and a global exception handler with request IDs (replace print) | [x] | B7, A7 |  | Request-ID logging; unhandled errors return a JSON 500 that still carries CORS headers; print() removed. Tested. |
| 2.2.2 | Dashboard stats: UTC-correct 'today', surface errors instead of returning 0 | [x] | B7 |  | 'Today' uses the business day (IST offset configurable); failures return 502 instead of zeros. The Home page shows the error. |
| 2.2.3 | Run blocking SDK calls (Gemini, Supabase) off the event loop | [x] | A3 |  | Sync endpoints run in the thread pool; Gemini and Supabase calls inside async code use asyncio.to_thread. |
| 2.2.4 | Config cleanup: drop unused JWT_SECRET / python-jose; add google-genai; pin and document deps | [~] | B9, A5 |  | Removed unused JWT_SECRET and python-jose; model names/thresholds/limits are now settings. Not done: add google-genai (needed with 3.2.3). |
| 2.2.5 | Remove dead code (mismatched models, unused prompts, broken match_materials_rpc.sql) | [ ] | B9 | 🗑 Delete | File deletions need approval. |
| 2.2.6 | Bounds and pagination limits on all list endpoints | [x] | B8 |  | limit/offset bounds on materials, inventory and receipts. |
| 2.2.7 | pytest scaffold with mocked Supabase and Gemini; first tests for auth and role checks | [x] | Q3 |  | 146 pytest tests with an in-memory fake Supabase (Arpit_Backend/tests). Run: venv\Scripts\python -m pytest |

---

# Phase 3 — Intake Pipeline (OCR, Barcode, Confirm, Matching)
**Steps complete:** 11 / 30

## Part 3.1 — OCR service  (3 / 6)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 3.1.1 | Robust JSON extraction (fence-tolerant, request JSON mime type) | [~] | A1 | 🌐 Quota | Fence-tolerant JSON extraction done and tested. Deliberately not done: forcing a JSON mime type, which cannot be tested without calling the live model. |
| 3.1.2 | Distinguish 'unreadable bill' from quota/network errors in the API response | [x] | A1 |  | Unreadable bill -> 422, quota -> 429, AI outage -> 502; Gemini exception mapping tested with the real exception classes. |
| 3.1.3 | Validate and coerce OCR fields (null/strings/units) before use | [x] | A2 |  | Numbers, units, ids and grades are normalised; junk rows are dropped instead of crashing. Tested. |
| 3.1.4 | Make OCR a read-only draft: no materials, queue rows or audit rows before confirm | [ ] | E4, E5, A7 | ❓ Decision | Design change proposed in Decisions Log D-6. |
| 3.1.5 | Signed URLs for the private bill-images bucket; correct file extension per type | [~] | A8 |  | Bills stored as paths in the private bucket; signed URLs on read; extension per type. Tested with fake storage; real Storage API not exercised. |
| 3.1.6 | Upload type/size validation with clear errors | [x] | E14, A8 |  | Type/size validation (415/413/422) in the API and in the upload dropzone. |

## Part 3.2 — Matching and CNMC  (1 / 6)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 3.2.1 | Batch embeddings and parallelise per-line work; run post-confirm matching as a BackgroundTask | [ ] | A3 | 🌐 Quota |  |
| 3.2.2 | Use configured similarity thresholds; implement auto-resolve for high-confidence exact matches | [~] | A4 |  | Exact matches above SIMILARITY_EXACT link to the catalog without creating a pending duplicate (tested with a fake AI). Live-model behaviour not yet observed. |
| 3.2.3 | Align stored and runtime embedding text and task type; re-embed materials | [ ] | A5 | 🔒 DB 🌐 Quota | Re-embedding writes to the database and uses Gemini quota. |
| 3.2.4 | Centralise model names in config (no floating alias in code) | [x] | A6 |  | Model names, embedding model/dimensions and thresholds come from settings. |
| 3.2.5 | Guard CNMC generation with a deterministic fallback; uniqueness enforced at confirm time | [~] | A2, E5 |  | Deterministic MISC-GEN fallback when Gemini fails (tested). CNMC uniqueness is still enforced at OCR time, not at confirm time. |
| 3.2.6 | Match new lines of the same bill against each other | [ ] | E5 |  |  |

## Part 3.3 — Confirm and receipts API  (1 / 6)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 3.3.1 | POST /intake/confirm calls the transactional RPC; returns GR number and totals | [~] | E2, E3, E6 |  | Implemented in Python instead of a DB function: validate, save, book stock (optimistic concurrency), price history, audit, and undo everything on any failure. Verified against a fake PostgREST and a browser run; real database not yet exercised. The RPC in 1.2.2 is still the route to a true transaction. |
| 3.3.2 | Server-side validation: date default, quantity > 0, location exists, quality in A/B/C | [x] | E1, E3 |  | Date, quantity > 0, price >= 0, grade A/B/C, vendor, locations, materials and line links are validated before anything is written; all problems are reported together. |
| 3.3.3 | Idempotency key to prevent double-submit creating two receipts | [~] | E3 |  | Idempotent per client_draft_id (tested). Two simultaneous requests with the same id could both pass the check; a unique index (DB change) would close that. |
| 3.3.4 | GET /intake/receipts with vendor/status/date filters, gr_number, vendor name, total | [~] | E9, E10 |  | Filters, gr_number, vendor name, total (tested against a fake PostgREST; live query syntax not yet exercised). |
| 3.3.5 | GET /intake/receipts/{id} with line items and material details | [~] | E8 |  | Header + lines + material info + signed bill URL (tested against a fake PostgREST; live query not yet exercised). |
| 3.3.6 | Approve/reject mapping endpoints use the RPC, require status = pending, write audit | [~] | E12 |  | Only pending matches can be reviewed (409 otherwise); update is compare-and-set; audit written. Merging stock / deprecating the duplicate still needs the approve_mapping RPC (1.2.3). |

## Part 3.4 — Intake UI  (6 / 12)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 3.4.1 | Default receipt date to today; validate before submit with inline errors | [x] | E1 |  | Date defaults to today, is required before OCR and Confirm, inline error. Browser-verified (Edge) against the real backend code + fake database. |
| 3.4.2 | Show real backend error messages in toasts | [x] | E1 |  | Backend messages shown in toasts (422 lists, plain details, network errors). Browser-verified. |
| 3.4.3 | After confirm: show GR number and navigate to the receipt detail | [x] | E1, E10 |  | Toast with GR number and item count; browser opens the saved receipt in Receipt History. Browser-verified. |
| 3.4.4 | Recompute line totals on edit; guard NaN; require quantity > 0 | [x] | E7 |  | Numeric fields never become NaN, totals follow edits, incomplete rows are highlighted, the draft is validated before sending. Browser-verified. |
| 3.4.5 | Send edited description/CNMC in the confirm payload and honour it server-side | [~] | E6 |  | Description edits are saved (as the bill text). CNMC is now read-only because the server does not persist CNMC edits. Incomplete until edits update the pending material. |
| 3.4.6 | Cancel without page reload; clear file state; discard the draft cleanly | [~] | E4, E14 |  | Cancel resets the draft without reloading and clears the file. Pending materials created during OCR remain in the database (E4) until D-6. |
| 3.4.7 | Receipt History: working filters, correct status values, detail panel with its own state | [x] | E8, E9, E10 |  | Filters sent to the API, correct status values, detail panel with own state and error handling. Browser-verified. |
| 3.4.8 | Home page: open the clicked receipt via ?id; fix status colour map | [x] | E9, E11 |  | Home opens the clicked receipt via ?id; GR numbers and status colours fixed. Browser-verified. |
| 3.4.9 | Pending Approvals: error toasts and result summary after approve/reject | [~] | E12 |  | Success/error toasts added (including 'already reviewed'); not exercised in a browser because the test fake has no matching-queue view. |
| 3.4.10 | Barcode tab: location dropdown, shared vendor/date header, stable onDecode, real new-material path | [~] | E13 |  | Done: stable camera handler, one lookup per scan, location dropdown, shared header, scanned-items list, honest not-in-catalog message. Not done: creating a new material from an unknown barcode. Camera scanning cannot be tested headless. |
| 3.4.11 | Separate OCR and barcode draft state | [ ] | E14 |  |  |
| 3.4.12 | Locations page: implement a real read-only list, or hide the menu item | [ ] | E15 | ❓ Decision |  |

---

# Phase 4 — Natural-Language Query (real Gemini)
**Steps complete:** 0 / 10

## Part 4.1 — NL→SQL service  (0 / 7)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 4.1.1 | LLM provider abstraction: Gemini by default; Ollama (Mistral or DeepSeek) as demo fallback | [ ] | G1 | ❓ Decision | Deployed-demo hosting of Ollama is an open question (D-5). |
| 4.1.2 | Schema-aware prompt limited to approved views with column descriptions and examples | [ ] | G1 | 🌐 Quota |  |
| 4.1.3 | SQL safety validator: single SELECT, allow-listed views, forced LIMIT, no functions/comments | [ ] | G1 |  |  |
| 4.1.4 | Executor uses the read-only role/RPC with a statement timeout | [ ] | G1 |  |  |
| 4.1.5 | Free-tier protection: per-user rate limit, result cache, daily request budget, graceful fallback | [ ] | G1 | 🌐 Quota |  |
| 4.1.6 | Log every query with provider, latency, success/error into nl_query_log | [ ] | G4, G1 | 🔒 DB | Writes rows at runtime via the app. |
| 4.1.7 | User-friendly error and no-result handling | [ ] | G1 |  |  |

## Part 4.2 — NL query UI  (0 / 3)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 4.2.1 | Fix API base URL usage (single API client, no optional-chained import.meta.env) | [ ] | G2 |  |  |
| 4.2.2 | Show real phases and the provider that answered; remove the fake 'Generating SQL with Gemini' text | [ ] | G1 |  |  |
| 4.2.3 | Persistent query history loaded from nl_query_log; remove the client-side insert | [ ] | G4 |  |  |

---

# Phase 5 — Engineer Dashboard
**Steps complete:** 0 / 9

## Part 5.1 — Home, map, catalog, detail  (0 / 9)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 5.1.1 | Engineer Home: correct columns, low-stock from v_low_stock_alerts / reorder levels | [ ] | G3 |  |  |
| 5.1.2 | Decide whether engineers may see pending materials (RLS) or the KPIs are relabelled | [ ] | G7 | ❓ Decision |  |
| 5.1.3 | Inventory map built from locations (empty bins shown) joined with inventory | [ ] | G5 |  |  |
| 5.1.4 | Bin colours from each row's reorder_level and max_stock | [ ] | G5 |  |  |
| 5.1.5 | Realtime updates working, or remove the 'Live' label | [ ] | G5 | ❓ Decision |  |
| 5.1.6 | Catalog category tree loaded from the database (matches CNMC tree, includes CIVIL) | [ ] | G6 |  |  |
| 5.1.7 | Real debounce, page reset on search, safe escaping of search text | [ ] | G6 |  |  |
| 5.1.8 | Material detail route: specs, inventory by bin, price history | [ ] | G6 |  | May reuse the layout of shrindhi MaterialDetail (D-4). |
| 5.1.9 | Equivalent materials via an access-safe RPC, both directions | [ ] | G6, G7 |  |  |

---

# Phase 6 — Accounts Dashboard on Real Data
**Steps complete:** 0 / 14

## Part 6.1 — API  (0 / 7)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 6.1.1 | Price comparison per material per vendor endpoint | [ ] | C1, B8 |  |  |
| 6.1.2 | Vendor ranking and savings calculation | [ ] | C1 |  |  |
| 6.1.3 | Savings opportunities endpoint | [ ] | C1 |  |  |
| 6.1.4 | Stock valuation by category using the latest price | [ ] | C1, C3 |  |  |
| 6.1.5 | Aging inventory endpoint (90/180/365 days) | [ ] | C1 |  |  |
| 6.1.6 | Vendor scorecard endpoint (price, quality, volume) | [ ] | C1 |  |  |
| 6.1.7 | Purchase history endpoint with filters and pagination | [ ] | C1 |  |  |

## Part 6.2 — UI  (0 / 7)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 6.2.1 | Accounts Home from real endpoints | [ ] | C1 |  |  |
| 6.2.2 | Price Intelligence from real endpoints | [ ] | C1 |  |  |
| 6.2.3 | Stock Valuation from real endpoints (real locations) | [ ] | C1, C2 |  |  |
| 6.2.4 | Vendor Analysis from real endpoints | [ ] | C1 |  |  |
| 6.2.5 | Purchase History from real endpoints | [ ] | C1 |  |  |
| 6.2.6 | Delete mockAccountsData.js and its utilities | [ ] | C2 | 🗑 Delete |  |
| 6.2.7 | Loading, empty and error states on all Accounts pages | [ ] | C1 |  |  |

---

# Phase 7 — Admin Dashboard
**Steps complete:** 0 / 12

## Part 7.1 — Material governance  (0 / 3)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 7.1.1 | Backend endpoints: approve, deprecate, bulk, edit, merge — each with audit, approved_by/at, deprecated_* fields | [ ] | M4, B8 |  |  |
| 7.1.2 | Governance UI calls the backend; confirmation dialogs for bulk actions | [ ] | M4 |  |  |
| 7.1.3 | Server-side pagination and safe search | [ ] | M4 |  |  |

## Part 7.2 — Audit trail  (0 / 2)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 7.2.1 | Audit query endpoint (paginated; filters: actor, action, entity, date range) | [ ] | M2, M7, B8 |  |  |
| 7.2.2 | Audit UI: correct columns, action/entity values from the data, date filter, actor names, escaped CSV | [ ] | M2, M7 |  |  |

## Part 7.3 — Duplicate detection  (0 / 3)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 7.3.1 | Matching stats endpoint and queue listing with correct columns/statuses | [ ] | M1, B8 |  |  |
| 7.3.2 | Merge / reject actions via the approve_mapping RPC with audit | [ ] | M1 |  |  |
| 7.3.3 | Duplicate detection UI rewired to the new endpoints | [ ] | M1 |  |  |

## Part 7.4 — Users and system health  (0 / 4)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 7.4.1 | Admin-only create-user endpoint (auth user + profile) and role change with audit | [ ] | M3, B8 |  |  |
| 7.4.2 | User list with correct columns; prevent self-deactivation; enforce is_active | [ ] | M3, B4 |  |  |
| 7.4.3 | System health: real DB, Gemini/Ollama status, recent errors, table sizes | [ ] | M6 |  |  |
| 7.4.4 | Admin Home KPIs computed correctly (duplicates, data quality) | [ ] | M5 |  |  |

---

# Phase 8 — One Consistent Dataset
**Steps complete:** 0 / 11

## Part 8.1 — Design and script  (0 / 5)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 8.1.1 | Write the dataset specification for review (vendors, locations, materials, receipts, price history, matches, audit) | [ ] |  | ❓ Decision |  |
| 8.1.2 | Idempotent seed script where inventory, price_history and audit rows are derived from the receipts | [ ] |  |  |  |
| 8.1.3 | Dry-run mode that prints what would change without contacting the database | [ ] |  |  |  |
| 8.1.4 | Remove the random seed_demo_data.py after replacement | [ ] |  | 🗑 Delete |  |
| 8.1.5 | Demo bill images generated from the dataset's own materials and vendors | [ ] |  |  |  |

## Part 8.2 — Apply to the database (one approval per action)  (0 / 6)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 8.2.1 | Plan cleanup of existing random demo rows (list exactly what will be removed) | [ ] |  | 🔒 DB 🗑 Delete |  |
| 8.2.2 | Apply cleanup | [ ] |  | 🔒 DB 🗑 Delete |  |
| 8.2.3 | Apply dataset | [ ] |  | 🔒 DB |  |
| 8.2.4 | Generate embeddings for the dataset (quota-aware) | [ ] | A5 | 🔒 DB 🌐 Quota |  |
| 8.2.5 | Run consistency verification queries (inventory = receipts, prices = lines, etc.) | [ ] |  | 🔒 DB |  |
| 8.2.6 | Reset demo account passwords | [ ] | S3 | 🔒 DB |  |

---

# Phase 9 — Frontend Structure, Session & Quality
**Steps complete:** 0 / 11

## Part 9.1 — Structure and session  (0 / 6)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 9.1.1 | Move a_p/ pages into arya_frontend/src and fix imports (no cross-tree imports) | [ ] | Q1 |  |  |
| 9.1.2 | shrindhi/: port anything still needed (MaterialDetail layout), then remove the app | [ ] | Q2 | ❓ Decision 🗑 Delete | Decision D-4; removal needs approval. |
| 9.1.3 | Single API client with token refresh and 401 handling | [ ] | S1 |  |  |
| 9.1.4 | Use Supabase session state (listener) instead of the mock_auth copy; document token-storage choice | [ ] | S1, S2 |  |  |
| 9.1.5 | Login: real full name from profile; correct placeholder | [ ] | S3 |  |  |
| 9.1.6 | Landing page: live stats from the database; remove unverifiable claims | [ ] | L1 |  |  |

## Part 9.2 — Quality  (0 / 5)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 9.2.1 | ESLint config and a clean lint run | [ ] | Q3 |  |  |
| 9.2.2 | Route-level code splitting | [ ] | Q3 |  |  |
| 9.2.3 | Frontend tests (Vitest + Testing Library) for intake, auth and approvals | [ ] | Q3 |  |  |
| 9.2.4 | README, env documentation, remove stray files and the empty root lockfile | [ ] | Q5 | 🗑 Delete |  |
| 9.2.5 | Consistent toast/error handling across pages | [ ] | E1, M4 |  |  |

---

# Phase 10 — Verification & Deployment
**Steps complete:** 0 / 8

## Part 10.1 — Verification  (0 / 4)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 10.1.1 | Regression pass: re-test every audit ID and record the result in progress.md | [ ] |  |  |  |
| 10.1.2 | End-to-end run for all 4 roles on real data | [ ] |  |  |  |
| 10.1.3 | Mobile-width pass on all dashboards | [ ] |  |  |  |
| 10.1.4 | Free-tier stress check of OCR + NL query flows | [ ] |  | 🌐 Quota |  |

## Part 10.2 — Deployment (nothing is pushed without approval)  (0 / 4)

| # | Step | Status | Refs | Flags | Notes |
|---|---|---|---|---|---|
| 10.2.1 | Frontend deployment config and env vars | [ ] | Q1 | ❓ Decision |  |
| 10.2.2 | Backend deployment config and env vars; health endpoint | [ ] |  | ❓ Decision |  |
| 10.2.3 | Push to GitHub | [ ] |  | ❓ Decision | Only with explicit approval. |
| 10.2.4 | Production smoke test and final demo rehearsal | [ ] |  |  |  |

---

## Audit findings status

A finding is **Closed** only when every step that references it is `[x]` and the fix was re-tested on the live stack in step 10.1.1. Until then it reads *Fixed - verify in 10.1.1*, *In progress* or *Open*.

| Finding | Steps | Status |
|---|---|---|
| E1 | 3.3.2, 3.4.1, 3.4.2, 3.4.3, 9.2.5 | In progress |
| E2 | 1.2.2, 3.3.1 | In progress |
| E3 | 1.2.2, 3.3.1, 3.3.2, 3.3.3 | In progress |
| E4 | 3.1.4, 3.4.6 | In progress |
| E5 | 1.2.2, 3.1.4, 3.2.5, 3.2.6 | In progress |
| E6 | 1.2.2, 3.3.1, 3.4.5 | In progress |
| E7 | 3.4.4 | Fixed - verify in 10.1.1 |
| E8 | 3.3.5, 3.4.7 | In progress |
| E9 | 3.3.4, 3.4.7, 3.4.8 | In progress |
| E10 | 3.3.4, 3.4.3, 3.4.7 | In progress |
| E11 | 3.4.8 | Fixed - verify in 10.1.1 |
| E12 | 1.2.3, 3.3.6, 3.4.9 | In progress |
| E13 | 3.4.10 | In progress |
| E14 | 3.1.6, 3.4.6, 3.4.11 | In progress |
| E15 | 3.4.12 | Open |
| B1 | 2.1.5 | In progress |
| B2 | 2.1.7 | Fixed - verify in 10.1.1 |
| B3 | 2.1.3 | In progress |
| B4 | 2.1.2, 7.4.2 | In progress |
| B5 | 2.1.1 | In progress |
| B6 | 2.1.4 | Fixed - verify in 10.1.1 |
| B7 | 2.2.1, 2.2.2 | Fixed - verify in 10.1.1 |
| B8 | 1.2.5, 1.2.6, 2.2.6, 6.1.1, 7.1.1, 7.2.1, 7.3.1, 7.4.1 | In progress |
| B9 | 2.2.4, 2.2.5 | In progress |
| B10 | 2.1.6 | Open |
| A1 | 3.1.1, 3.1.2 | In progress |
| A2 | 3.1.3, 3.2.5 | In progress |
| A3 | 2.2.3, 3.2.1 | In progress |
| A4 | 3.2.2 | In progress |
| A5 | 2.2.4, 3.2.3, 8.2.4 | In progress |
| A6 | 3.2.4 | Fixed - verify in 10.1.1 |
| A7 | 1.2.2, 2.2.1, 3.1.4 | In progress |
| A8 | 3.1.5, 3.1.6 | In progress |
| G1 | 1.2.4, 4.1.1, 4.1.2, 4.1.3, 4.1.4, 4.1.5, 4.1.6, 4.1.7, 4.2.2 | Open |
| G2 | 4.2.1 | Open |
| G3 | 5.1.1 | Open |
| G4 | 4.1.6, 4.2.3 | Open |
| G5 | 0.3.4, 1.2.7, 5.1.3, 5.1.4, 5.1.5 | Open |
| G6 | 5.1.6, 5.1.7, 5.1.8, 5.1.9 | Open |
| G7 | 5.1.2, 5.1.9 | Open |
| C1 | 1.2.5, 6.1.1, 6.1.2, 6.1.3, 6.1.4, 6.1.5, 6.1.6, 6.1.7, 6.2.1, 6.2.2, 6.2.3, 6.2.4, 6.2.5, 6.2.7 | Open |
| C2 | 6.2.3, 6.2.6 | Open |
| C3 | 1.2.5, 6.1.4 | Open |
| M1 | 7.3.1, 7.3.2, 7.3.3 | Open |
| M2 | 7.2.1, 7.2.2 | Open |
| M3 | 7.4.1, 7.4.2 | Open |
| M4 | 7.1.1, 7.1.2, 7.1.3, 9.2.5 | Open |
| M5 | 1.2.6, 7.4.4 | Open |
| M6 | 1.2.6, 7.4.3 | Open |
| M7 | 7.2.1, 7.2.2 | Open |
| D1 | 0.3.2, 1.1.1, 1.1.2 | Open |
| D2 | 0.3.1, 1.1.3 | Open |
| D3 | 0.3.3, 1.1.4, 1.1.5, 1.1.6 | Open |
| D4 | 0.3.5, 1.2.8 | Open |
| D5 | 1.2.1 | Open |
| S1 | 9.1.3, 9.1.4 | Open |
| S2 | 9.1.4 | Open |
| S3 | 8.2.6, 9.1.5 | Open |
| Q1 | 9.1.1, 10.2.1 | Open |
| Q2 | 9.1.2 | Open |
| Q3 | 2.2.7, 9.2.1, 9.2.2, 9.2.3 | In progress |
| Q4 | 0.2.3 | Fixed - verify in 10.1.1 |
| Q5 | 0.2.1, 9.2.4 | Open |
| L1 | 9.1.6 | Open |
| P1 | 0.1.1, 0.1.3 | Fixed - verify in 10.1.1 |

## Manual test checklist (real stack)

Run the backend (`uvicorn main:app --reload` in `Arpit_Backend`) and the frontend, log in as the entry operator, then:

1. **Confirm receipt** - New Receipt -> pick a vendor -> upload a bill -> Process. The date is pre-filled with today. Set a location on every row -> Confirm. Expect: a toast with the GR number, then the receipt opens in Receipt History.
2. **Stock and prices** - confirmed quantities are booked in `inventory` and one `price_history` row is written per priced line. Lines for new or near-duplicate materials are booked to their *pending* material, so engineers see that stock only once the material is approved.
3. **Blocked confirm** - leave a location empty and press Confirm: the message names the line and the missing field; nothing is saved.
4. **Double submit** - press Confirm twice quickly: one receipt only.
5. **Bad bill** - upload a non-bill image: a clear 'no line items' message (not a generic failure). Upload a .txt: 'Unsupported file type'.
6. **Receipt History** - filters (vendor, status, dates) change the list; clicking a receipt shows its lines, vendor and GR number; the Home page links to the same receipt.
7. **Pending Approvals** - approve or reject a match; a second click on an already-reviewed item shows an 'already reviewed' message.
8. **Barcode tab** - camera starts once and stays running; scan a known CNMC/legacy code; pick a location; Confirm All.
9. **Auth** - a deactivated user or a user without a profile can no longer sign in (clear message); Logout works.

Known gaps you may notice: approving a mapping does not merge stock yet (E12); unknown barcodes cannot create new materials yet; the receipt-detail table needs a horizontal scroll to see Quality/Location in the narrow panel.

## Blockers

| Date | Blocker | Affected steps | Resolution |
|---|---|---|---|
| — | — | — | — |

## Session log

### 2026-09-19
- Full audit completed; `audit.md` written (65 findings).
- `plan.md` and `progress.md` rewritten; the previous progress claim (116/130 done) was inaccurate and has been discarded.
- No project code and no database was changed.
- Plan order approved by the user. Pre-audit working tree committed locally as `5cedcce` (step 0.2.3); nothing pushed.
- Backend (commit `c8f5b9c`): confirm-receipt rewritten (validation, stock via optimistic concurrency, price history, audit, undo on failure, idempotency), receipts list/detail, OCR hardening, auth hardening, request-ID logging, tests.
- Frontend (commit `27bd990`): GR number + redirect, shared header, editor validation, receipt history, home fixes, barcode fixes.
- Verification: 146 backend tests; production build; 27-check browser run (Edge via Playwright) of the real frontend against the real backend code with an in-memory fake database. No Supabase or Gemini call was made; no database was touched.
- Steps 3.4.1 + 3.4.2 (audit E1): receipt date now defaults to today and is validated before OCR/Confirm with an inline error; intake toasts show the backend error text. Files: `intakeStore.js`, `useIntake.js`, `lib/utils.js`, `OCRUpload.jsx`. Verified: Node checks of store default/reset and error helper, production build. NOT yet verified in a browser (needs live login).
