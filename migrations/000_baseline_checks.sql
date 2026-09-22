-- ============================================================
-- Saarthi — Phase 0.3 baseline checks (READ-ONLY)
-- ============================================================
-- Nothing here writes to the database. Run each SELECT in the Supabase
-- SQL Editor and paste the results back so the audit's "db-unverified"
-- findings (D1-D4) can be confirmed or closed, and so 001_access_control.sql
-- can be reviewed against what is actually live before you run it.
-- Plan steps: 0.3.1 - 0.3.6
-- ============================================================

-- 0.3.1 (refs D2) — Is public sign-up enabled?
-- This can't be read from SQL; it's an Auth setting.
-- Check: Supabase Dashboard -> Authentication -> Providers -> Email -> "Allow new users to sign up".
-- Report back: enabled or disabled.

-- 0.3.2 (refs D1) — Live RLS policies on profiles: do they match schema.sql?
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

-- 0.3.3a (refs D3) — Grants to anon/authenticated on tables, views and routines.
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 0.3.3b (refs D3) — security_invoker setting on the four views.
SELECT c.relname AS view_name, c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
  AND c.relname IN ('v_inventory_full', 'v_price_comparison', 'v_low_stock_alerts', 'v_matching_queue_detailed');

-- 0.3.3c (refs D3) — SECURITY DEFINER functions missing SET search_path.
SELECT p.proname, p.prosecdef AS is_security_definer, p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef = true;

-- 0.3.4 (refs G5) — Is inventory in the supabase_realtime publication?
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public';

-- 0.3.5 (refs D4) — Vector index definition and size context.
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'materials' AND indexdef ILIKE '%embedding%';

SELECT COUNT(*) AS total_materials, COUNT(embedding) AS materials_with_embedding
FROM public.materials;

-- 0.3.6 — Baseline row counts (context for the Phase 8 dataset work).
SELECT 'vendors' AS table_name, COUNT(*) FROM public.vendors
UNION ALL SELECT 'materials', COUNT(*) FROM public.materials
UNION ALL SELECT 'locations', COUNT(*) FROM public.locations
UNION ALL SELECT 'inventory', COUNT(*) FROM public.inventory
UNION ALL SELECT 'goods_receipts', COUNT(*) FROM public.goods_receipts
UNION ALL SELECT 'gr_line_items', COUNT(*) FROM public.gr_line_items
UNION ALL SELECT 'price_history', COUNT(*) FROM public.price_history
UNION ALL SELECT 'matching_queue', COUNT(*) FROM public.matching_queue
UNION ALL SELECT 'audit_log', COUNT(*) FROM public.audit_log
UNION ALL SELECT 'nl_query_log', COUNT(*) FROM public.nl_query_log
UNION ALL SELECT 'profiles', COUNT(*) FROM public.profiles;
