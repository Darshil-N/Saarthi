# Migrations

This folder replaces the "run the whole `schema.sql` in the SQL Editor" workflow with
small, reviewable, numbered files. **Claude does not run these against Supabase.**
Per the project's working rules, you run each file yourself (Supabase SQL Editor,
or `psql`), in order, and report back what happened (success, row counts, any error)
so the corresponding plan.md/progress.md steps can be marked done.

## How to apply

1. Open the file, read it — every statement is commented with the plan step and
   audit finding it fixes.
2. Run it in the Supabase SQL Editor for the Saarthi project (or via `psql` against
   the same database).
3. Tell Claude what happened: "ran 001, no errors" / paste the error / paste query
   output for a `SELECT`-only file.

## Files

| File | Type | What it does |
|---|---|---|
| `000_baseline_checks.sql` | Read-only | Phase 0.3 — queries the live database's current RLS policies, grants, `security_invoker` settings, realtime publication membership, vector index definition and per-table row counts. Nothing is changed. Run this first and paste back the output — it confirms the `db-unverified` audit findings before `001` is applied. |
| `001_access_control.sql` | Write (DDL) | Phase 1.1 — closes the privilege-escalation and RLS/grant holes found in the audit (D1, D2, D3) and applies decision D-7 (which roles may review material/mapping matches). **Applied 2026-09-22.** |
| `002_confirm_and_approve_rpcs.sql` | Write (DDL, additive) | Phase 1.2 — the `confirm_receipt` and `approve_mapping` transactional functions (steps 1.2.2, 1.2.3), plus a `client_draft_id` column on `goods_receipts`. **Applied 2026-09-22.** `approve_mapping` has since been live-verified (2026-09-22 and 2026-09-24); `confirm_receipt` has not yet completed a live end-to-end run (an attempt was stopped for taking too long — see progress.md). |
| `003_dashboard_demo_data.sql` | Write (DML, additive, not a migration) | Not schema — a small, purely-additive set of rows (2 materials, 1 inventory row, 1 goods receipt, 2 matching_queue rows) so every dashboard has something real and non-zero to show while testing. Reads as ordinary catalog data, no "demo" marker in the values themselves; its cleanup block (commented out) finds the rows by their exact inserted values instead. Nothing existing is modified. This is **not** the Phase 8 "one consistent dataset" (still open) — just enough to click through the UI. |

`schema.sql` (repo root and `backend/`, currently identical copies — audit
finding D5) stays as the historical "run this on a brand-new empty database" bootstrap
file. Once there's a real live database, these numbered migrations are the source of
truth for further changes; `schema.sql` itself is not re-run. Removing the duplicate
copy is step 1.2.1 and needs your separate approval since it's a file deletion.
