# Saarthi — Codebase Audit

**Date:** 2026-09-19
**Scope:** `backend/` (FastAPI), `frontend/` (main React app), `a_p/` (Engineer / Accounts / Admin pages imported by the main app), `shrindhi/` (separate React app), `schema.sql`, seed scripts, `plan.md`, `progress.md`.
**Method:** Static read of all source against `schema.sql`, plus a few local reproductions. **No Supabase query was run and nothing in the project was modified.**

## How to read this file

Severity: **C** critical (feature broken or security hole) · **H** high · **M** medium · **L** low.

Evidence level (last tag on each finding):
- `verified` — reproduced by running code locally (no database or Gemini involved).
- `code` — established by reading the code against `schema.sql`.
- `db-unverified` — depends on the live database state; must be checked with the user's approval, one action at a time.

Every finding ID here is mapped to fix steps in `plan.md` and tracked in `progress.md`.

---

## 0. The three problems reported during testing

| # | Report | Root cause |
|---|---|---|
| 1 | Entry operator: after scanning a bill, Confirm goes nowhere | E1 (empty date → HTTP 422, generic toast), E2 (even success would not touch inventory), E3 (no transaction, unhandled 500s) |
| 2 | No dashboard is attached to Supabase | C1 (Accounts is 100 % mock), M1/M2/M3/G3 (wrong column names → query errors swallowed → empty pages), L1 (Landing hardcoded) |
| 3 | All data is fake | Seeds in `schema.sql`, random rows from `seed_demo_data.py`, `Math.random()` in `a_p/data/mockAccountsData.js`, constants in `Landing.jsx`, the unused `shrindhi/` mock app |

---

## 1. Entry operator flow (`frontend`, `/intake/*`)

- **E1 [C] Confirm Receipt fails on an empty date** — `intakeStore.js` initialises `receipt_date` to `''`; `OCRUpload.handleConfirm` never validates it. Backend `ConfirmRequest.receipt_date: date` returns 422 ("input is too short"). The hook shows only "Failed to confirm receipt", so the click appears to do nothing. Even on success the store resets, no GR number is shown and there is no redirect. — `verified`
- **E2 [C] Confirm never updates stock or price history** — `intake.py:250-298` inserts `goods_receipts` and `gr_line_items` only. No `inventory` upsert and no `price_history` insert exists anywhere in the backend. Lines for new materials are stored with `material_id = NULL`. Plan steps 2.4.4 / 2.4.5 were marked done but are not implemented. — `code`
- **E3 [C] Confirm is not atomic and has no error handling** — GR header and line items are separate inserts. A failing line item (empty `quality_grade` violates the A/B/C CHECK, unknown `location_code` violates the FK, `quantity_received <= 0`) leaves an orphan GR with status `completed` and returns a bare 500. — `code`
- **E4 [C] OCR has database side effects before the user confirms** — `_build_line_item` (`intake.py:14-130`) inserts a pending `materials` row, a `matching_queue` row and audit rows for every scanned line. Cancel (which reloads the page), deleting a row, or scanning again leaves orphans. — `code`
- **E5 [C] Exact/near matches create duplicate materials** — for a matched line the new pending material reuses the matched material's CNMC. The `materials_cnmc_key` unique constraint forces a `-2`, `-3` … suffix (`intake.py:55-85`), so the pipeline manufactures the duplicates it is supposed to detect. — `code`
- **E6 [H] Edits to description / CNMC are ignored** — the material row is created at OCR time; `/confirm` stores the edited description only as `raw_description` and never reads `cnmc`. — `code`
- **E7 [H] Table totals are stale; cleared numbers break the request** — editing quantity/price does not recompute `total_price` (the footer sums the stale value). Clearing a number input yields `parseFloat('') = NaN` → JSON `null` → 422. — `verified`
- **E8 [H] Receipt detail endpoint does not exist** — `useReceipt` calls `GET /intake/receipts/{id}`; only the list route exists. `ReceiptHistory` shows skeletons forever and its `useEffect` overwrites the shared intake store's line items. — `code`
- **E9 [H] Receipt History filters do nothing** — vendor/status/date filters are sent as query params; `get_receipts` only accepts `limit`. The status option `confirmed` is not a schema value (`completed` is). `EntryHome` badge map has the same wrong key. — `code`
- **E10 [M] GR number never shown** — `goods_receipts.gr_number` is never returned; UI shows the first UUID segment. Detail header shows vendor as a raw UUID. — `code`
- **E11 [M] Clicking a receipt on Home does not open it** — navigates to `/entry/history?id=…`; `ReceiptHistory` never reads `id`. — `code`
- **E12 [H] Approve/Reject mapping is only a status flip** — `matching.py` approve does not merge quantities, transfer inventory or deprecate the duplicate (plan 3.4.2). No check that the row is still `pending`. Mutation failures show no error toast (optimistic removal rolls back silently). — `code`
- **E13 [H] Barcode tab defects** — location is a free-text box (FK violation on a typo); vendor can only be selected on the OCR tab and receipt date is never set; a barcode that is not found creates no material/CNMC despite the UI copy; `handleDecode` is recreated every render and is an effect dependency in `BarcodeOverlay`, so the camera restarts on every state change (likely). — `code`
- **E14 [M] OCR and barcode flows share one store** — items from both tabs mix; the chosen file is not cleared after success; no client-side file-size check although the bucket limit is 10 MB. — `code`
- **E15 [M] "Locations" page is a stub** — sidebar entry leads to "Coming soon". — `code`

## 2. Backend API (`backend`)

- **B1 [C] Missing role checks on write endpoints** — `/intake/confirm` and `/intake/barcode` only require a valid token. Any logged-in role can create goods receipts through the service-key client (which bypasses RLS). — `code`
- **B2 [H] `.single()` turns "not found" into HTTP 500** — used in `matching.py`, `inventory.py`, `auth.py`; postgrest raises when zero rows match, so the `if not resp.data → 404` branches are unreachable. — `code`
- **B3 [H] Logout is a no-op** — `supabase.auth.sign_out()` is called on a freshly created client, so the user's token stays valid. — `code`
- **B4 [H] Auth fallbacks are unsafe** — `get_current_user` defaults the role to `entry_operator` when the profile is missing (also in `/auth/login`); `is_active` is never checked, so deactivated users can still sign in. — `code`
- **B5 [M] Per-request overhead** — `get_supabase()` builds a new client per dependency; `get_current_user` builds two more and makes a network call to Supabase Auth on every request. — `code`
- **B6 [M] Internal error text leaks to clients** — `detail=f"Invalid token: {exc}"` and `detail=str(exc)` on login. — `code`
- **B7 [M] Dashboard stats hide failures** — every query in `dashboard.py` is wrapped in `try/except → 0`; "today" uses server-local `date.today()` against UTC timestamps. — `code`
- **B8 [M] Endpoints in the plan that do not exist** — pricing comparison and opportunities, stock valuation, aging, vendor scorecard, audit query, matching stats, user create, system health, `/dashboard/admin`, material edit/deprecate/bulk/merge, receipt detail. — `code`
- **B9 [M] Dead or wrong code** — `models/inventory.py`, `models/matching.py`, `models/materials.py` use column names that do not exist and are unused; `match_materials_rpc.sql` references non-existent columns (`m.type`, `m.quality`); `prompts/prompts.py` OCR/MATCHING prompts are unused duplicates; `JWT_SECRET` is required by `Settings` but never used; `python-jose` unused. — `code`
- **B10 [M] Approval authority is too broad** — entry operators and engineers may approve materials and mappings; the plan describes admin governance. Needs a decision. — `code`

## 3. AI pipeline (OCR, embeddings, matching, CNMC)

- **A1 [H] OCR JSON parsing breaks on fenced output** — `ocr_service.py:39-40` strips a single backtick instead of the three-backtick fence; Gemini output wrapped in ```` ```json ```` fails `json.loads`, `run_ocr` returns `[]` and the API reports a misleading 422 "Could not extract line items". All exceptions (quota, network) are swallowed the same way. — `verified`
- **A2 [H] Unvalidated OCR values crash the request** — `float(raw.get("quantity", 0))` raises on `null` or strings like "5 nos"; `generate_cnmc` has no try/except around the Gemini call so one failure aborts the whole bill. — `code`
- **A3 [H] Matching blocks the request** — the plan says BackgroundTask; the code runs matching inline, sequentially per line, using blocking SDK calls inside `async def` (embedding, RPC, one Gemini call to match, one to generate a CNMC). A 10-line bill means 30+ network calls on the event loop. — `code`
- **A4 [H] No auto-resolution and unused thresholds** — plan 3.2.5 not implemented; `SIMILARITY_EXACT/NEAR` settings are defined but never used; candidate threshold `0.70` is hardcoded. — `code`
- **A5 [M] Stored vs runtime embeddings differ** — `seed_embeddings.py` embeds `"Description: …\nTechnical Specs: …"` with the default task type via `google-genai`; runtime embeds the bare description with `task_type="retrieval_query"` via the deprecated `google-generativeai`. `google-genai` is not in `requirements.txt`. — `code`
- **A6 [M] Floating, hardcoded model alias** — `gemini-flash-lite-latest` appears in three files; behaviour can change without a code change. — `code`
- **A7 [M] Silent insert failures** — `matching_queue.matched_material_id` is NOT NULL, so the queue insert for "new material" lines fails and is only `print`ed; `materials.material_type` is NOT NULL, so a Gemini reply without `type` also fails silently. — `code`
- **A8 [M] Bill image URLs are dead** — `get_public_url` is used on a private bucket; PNG/WebP uploads are saved with a `.jpg` extension; upload failure is swallowed and `bill_image_url` becomes null. — `code`

## 4. Engineer dashboard (`a_p/engineer/*`, `/materials/nl-query`)

- **G1 [C] "NL→SQL" is not NL→SQL** — `materials.py:32-122` keyword-matches the question (OR semantics) against two views. No Gemini call, no SQL validator, no real SQL; the displayed `sql` string is fabricated; the UI says "Generating SQL query with Gemini AI…". Plan 4.1.1–4.1.3 were marked done. — `code`
- **G2 [C] NL Query cannot reach the API in production** — `NLQuery.jsx` uses `import.meta?.env?.VITE_API_BASE_URL`; Vite does not inline the optional-chained form, so the built bundle always falls back to `http://localhost:8000`. — `verified` (production build inspected)
- **G3 [H] Low-stock panel is always empty** — `EngineerHome` selects and orders by `quantity_on_hand`; the column is `quantity`. The error is ignored. — `code`
- **G4 [H] Client-side `nl_query_log` insert is wrong** — uses columns `query`/`result_count`, no `user_id` (real columns: `natural_language_query`, `query_result_count`, `user_id`); fails silently and duplicates the backend's own log. History is in-memory only. — `code`
- **G5 [H] Inventory map** — colours use fixed defaults (reorder 10, max 100) instead of each row's `reorder_level`/`max_stock`; the grid is built from inventory rows so empty bins never appear; the "Live" claim relies on a realtime publication that `schema.sql` does not create. — `code` (publication: `db-unverified`)
- **G6 [M] Material catalog** — hardcoded category tree differs from the backend's (`PUMP`, `BEARING`, `CTRL`… vs `SEAL`, `BEAR`, `INSTRU`…; `CIVIL` missing) so many filters return nothing; debounce is fake (search fires immediately and again after 400 ms); page not reset when searching; search text is interpolated into the PostgREST `.or()` string; "Equivalents" reads `matching_queue` (engineers cannot select it, and only one direction is queried); no price history and no detail route (plan 4.3.3). — `code`
- **G7 [M] Engineers cannot see pending materials** — `materials_select_all` policy limits non-admin/non-entry roles to `status = 'approved'`, so "Total Materials" equals "Approved" and "Pending Review" is always 0. — `code` (policy as written in `schema.sql`; live state `db-unverified`)

## 5. Accounts dashboard (`a_p/pages/Accounts*`, Price, Stock, Vendor, Purchase)

- **C1 [C] Entire dashboard is mock data** — five pages plus `utils/accountsUtils.js` read `a_p/data/mockAccountsData.js`, which generates vendors/materials/purchases with `Math.random()` at import time. Numbers change every reload. — `code`
- **C2 [H] Mock data does not exist in the database** — invented vendors (TechMech…), materials (Steel Pipe 4"…), CNMCs (`CNMC-1000`), hardcoded location "Primary Warehouse". — `code`
- **C3 [M] Database aggregates exist but are unused** — view `v_price_comparison` and RPC `get_inventory_value_by_category` are never called. — `code`

## 6. Admin dashboard (`a_p/pages/*` admin)

- **M1 [C] Duplicate Detection is always empty and "Merge" is broken** — selects `similarity_score` and `incoming_material_id` (columns are `vector_similarity`/`confidence_score` and `new_material_id`); default filter `pending_review` and status `merged` are not valid (`pending`, `approved`, `rejected`, `auto_resolved`); the update to `merged` violates the CHECK constraint and would not merge anything anyway. — `code`
- **M2 [C] Audit Trail is always empty** — selects `old_values`, `new_values`, `metadata`; columns are `old_value`, `new_value`, and there is no `metadata`. Filter values (`INSERT`, `APPROVE`, `material`, `goods_receipt`) do not match what the backend writes (`material_approved`, `materials`, `goods_receipts`). — `code`
- **M3 [C] User Management cannot list or create users** — selects `org_unit` (column is `department`); "Create user" inserts a profile with a random UUID (violates the FK to `auth.users` and RLS `profiles_insert_self`), never creates an auth user, discards the email. Deactivation is not enforced anywhere (see B4) and an admin can deactivate themself. — `code`
- **M4 [H] Material Governance writes directly from the browser** — no audit rows; approve does not set `approved_by/approved_at`; deprecate sets no `deprecated_*` fields; no merge (plan 6.1.5); bulk actions have no confirmation; no pagination (limit 100); same `.or()` interpolation issue as G6. — `code`
- **M5 [M] Admin Home KPIs are misleading** — "Duplicates" counts every `matching_queue` row; "Data Quality" measures `technical_specs`, which the intake pipeline never populates. — `code`
- **M6 [M] System Health is mostly static** — "pgvector: Active" hardcoded; latency is the time of five count queries; notice refers to a non-existent `/dashboard/admin`; no error/API-usage metrics (plan 6.4.3). — `code`
- **M7 [M] Audit Trail usability** — search covers only the current page; no date filter (plan 6.2.2); CSV export is not escaped; actors shown as UUIDs. — `code`

## 7. Database & security (`schema.sql`)

- **D1 [C] Privilege escalation via `profiles`** — `profiles_update_own` has no column restriction, so any user can set their own `role` to `admin`; `profiles_insert_self` allows inserting a profile with any role. — `code` (live policies `db-unverified`)
- **D2 [C] Role taken from signup metadata** — `handle_new_user` reads `raw_user_meta_data->>'role'`. If public signup is enabled, anyone can register as `admin`. — `code` (signup setting `db-unverified`)
- **D3 [H] Views and functions bypass RLS / are over-granted** — views are not `security_invoker`; `GRANT ALL … TO anon` covers views and `SECURITY DEFINER` RPCs (`get_admin_dashboard_stats`, `get_inventory_value_by_category`), so they may be callable without login; `SECURITY DEFINER` functions have no `SET search_path`. — `code` (`db-unverified`)
- **D4 [M] Vector index may hide candidates** — `ivfflat (lists = 100)` on a table of tens of rows; with default probes recall can be poor or empty. — `db-unverified`
- **D5 [L] Two identical copies of `schema.sql`** (repo root and `backend/`) will drift; no migrations folder. — `code`

## 8. Auth & session (frontend)

- **S1 [H] Stale token, no refresh** — `api.js` and `NLQuery.jsx` read the access token from `localStorage['mock_auth']` written at login. After ~1 hour every API call returns 401; there is no refresh, no 401 handler and no auto-logout. Storing the token in `localStorage` also exposes it to XSS. — `code`
- **S2 [M] Client-side role guard trusts `localStorage`** — `ProtectedRoute` reads the role from a store hydrated from `localStorage`; the backend enforces roles, but the direct-Supabase pages rely on RLS (see D1). — `code`
- **S3 [L] Login polish** — displays the email as the user's name (profile `full_name` not fetched); placeholder uses `.com` while accounts are `.in`; demo passwords were never reset (`progress.md` 7.3.4 blocked). — `code`

## 9. Structure, build and quality

- **Q1 [H] Cross-tree imports** — `frontend/src/App.jsx` imports from `../../a_p/**`; `a_p/AdminDashboard.jsx` imports back from `../frontend/src/**`; `a_p/utils/supabase.js` re-exports arya's client. Builds locally, but a hosted build whose root is `frontend` may not include `a_p`. — `code` (hosting behaviour unverified)
- **Q2 [M] `shrindhi/` is dead code** — a separate Vite app with `isAuthenticated: true` and a hardcoded dev engineer, ~1,100 lines of mock materials; nothing imports it. Its `MaterialDetail` and `MyQueries` pages exist nowhere else. — `code`
- **Q3 [M] No tests, no lint config, single 1.7 MB chunk** — `npm run lint` has no ESLint config; no test files anywhere; production build is one chunk. — `verified` (build)
- **Q4 [M] Uncommitted work** — 12 modified files and 1 untracked file (`backend/seed_demo_data.py`) in the working tree. — `verified` (`git status`)
- **Q5 [L] Hygiene** — `README.md` is 9 bytes; root `package-lock.json` is empty; `.uv.err` / `.uvicorn.err` in repo root; data access is a mix of API calls and direct Supabase queries. — `code`

## 10. Landing page and project records

- **L1 [M] Landing page shows invented statistics** — "1,24,892 Active Material Codes", "3,847 Pending Deduplication", "₹890 Cr Estimated Savings", "99.2 % Data Accuracy", "97 % accuracy", with the caption "Data updates live via Saarthi AI pipeline". None is read from the database (plan 7.1.2 marked done). — `code`
- **P1 [H] `progress.md` was inaccurate** — it reported 116 / 130 steps complete. Steps marked done but not backed by code: 2.4.4, 2.4.5, 3.2.4, 3.2.5, 3.4.2, 4.1.1–4.1.3, 4.3.3, 4.4.2, 4.4.4, all of Phase 5, 6.1.5, 6.2.x, 6.3.x, 6.4.x, 7.1.2. — `code`

---

## Checks that need the live database (each requires the user's approval, one at a time)

| Check | Related | Why |
|---|---|---|
| Is public sign-up enabled in Supabase Auth? | D2 | Decides whether D2 is exploitable today |
| Live RLS policies on `profiles` | D1 | Confirm the update/insert policies match `schema.sql` |
| Grants to `anon` on views/RPCs; view `security_invoker` setting | D3 | Confirm unauthenticated access |
| Is `inventory` in the `supabase_realtime` publication? | G5 | Whether "Live" works |
| Vector index definition and candidate recall | D4 | Matching quality |
| Row counts per table (baseline) | dataset | Needed to plan the consistent dataset |

## Findings by count

Critical: 14 · High: 22 · Medium: 26 · Low: 3 — **65 finding IDs** in total. Several IDs bundle related sub-issues, so the number of individual defects is higher than 65.
