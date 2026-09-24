-- ============================================================
-- Saarthi — Phase 1.1 access control fixes
-- ============================================================
-- Fixes audit findings D1, D2, D3 and applies decision D-7.
-- Written 2026-09-22. Review before running; run the whole file once,
-- in the Supabase SQL Editor, against the live database.
-- Every statement is safe to re-run (DROP ... IF EXISTS before CREATE,
-- CREATE OR REPLACE, REVOKE of something already revoked is a no-op).
-- Plan steps: 1.1.1, 1.1.2, 1.1.3, 1.1.4, 1.1.5, 1.1.6, plus the D-7 RLS
-- update for matching_queue.
-- ============================================================


-- ------------------------------------------------------------
-- 1.1.3 (refs D2) — handle_new_user must not trust client-supplied role.
-- Previously: COALESCE(raw_user_meta_data->>'role', 'engineer') let anyone
-- who can sign up choose their own role, including 'admin'.
-- Now: role is always the least-privileged value, ignoring metadata
-- entirely, and new profiles start INACTIVE so an admin must activate
-- them (and set the real role) before they can do anything. This is a
-- product-visible change to onboarding — flag it back if you want new
-- sign-ups to start active.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    'entry_operator',
    FALSE
  );
  RETURN NEW;
END;
$$;


-- ------------------------------------------------------------
-- 1.1.1 (refs D1) — a user must not be able to change their own role or
-- is_active, however the UPDATE reaches profiles (profiles_update_own or
-- profiles_update_admin). A trigger is used instead of a column-grant
-- because it can't be bypassed by any future policy on this table, and it
-- also stops an admin from deactivating or de-roling themselves by
-- mistake (matches step 7.4.2's "prevent self-deactivation").
-- auth.uid() is NULL for the backend's service-role connection, so this
-- never blocks a legitimate admin-driven change made through the API.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.id
     AND (NEW.role IS DISTINCT FROM OLD.role OR NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
    RAISE EXCEPTION 'You cannot change your own role or active status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_privilege_escalation();


-- ------------------------------------------------------------
-- 1.1.2 (refs D1) — profiles_insert_self let a signed-in user insert a
-- profile row for themselves with any role, ahead of or alongside the
-- handle_new_user trigger. The trigger is now the only way a profile row
-- is created, so this policy is removed rather than constrained.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;


-- ------------------------------------------------------------
-- 1.1.6 (refs D3) — SET search_path on every SECURITY DEFINER function.
-- Without it, a SECURITY DEFINER function resolves unqualified names
-- using the caller's search_path, which can be hijacked. get_my_role is
-- also strengthened here to return NULL for a deactivated profile, so
-- every RLS policy written as `get_my_role() = ...` or
-- `get_my_role() IN (...)` automatically denies a deactivated user even
-- if a future grant is misconfigured (defense in depth alongside 1.1.5).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE;
$$;

CREATE OR REPLACE FUNCTION public.get_inventory_value_by_category()
RETURNS TABLE (
  category    TEXT,
  total_value NUMERIC,
  item_count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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


-- ------------------------------------------------------------
-- 1.1.4 (refs D3) — views must be security_invoker so RLS applies to
-- whoever queries them, not to the view owner.
-- ------------------------------------------------------------
ALTER VIEW public.v_inventory_full         SET (security_invoker = on);
ALTER VIEW public.v_price_comparison       SET (security_invoker = on);
ALTER VIEW public.v_low_stock_alerts       SET (security_invoker = on);
ALTER VIEW public.v_matching_queue_detailed SET (security_invoker = on);


-- ------------------------------------------------------------
-- 1.1.5 (refs D3) — revoke the blanket anon/authenticated grants.
-- Decision D-1 (2026-09-22): all reads and writes go through FastAPI,
-- which connects with the service_role key (unaffected by these
-- REVOKEs). The frontend confirmed to make no direct supabase.from()/
-- .rpc() calls, so anon/authenticated no longer need table, view or
-- routine access at all — leaving it granted only lets someone with the
-- publishable anon key query Supabase's REST API directly, bypassing the
-- backend's validation, role checks and audit logging entirely.
-- Supabase Auth (schema `auth`) and Storage (schema `storage`) are
-- separate schemas and are not affected by these REVOKEs.
-- ------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, authenticated;


-- ------------------------------------------------------------
-- Decision D-7 (decided 2026-09-22, refs B10) — entry_operator, engineer,
-- accounts and admin may all review (approve/reject) matches. The RLS
-- policy on matching_queue previously only allowed entry_operator/admin;
-- widened here to match the backend's _REVIEWERS list
-- (backend/routers/matching.py). This does not currently gate the
-- API, which connects as service_role, but keeps RLS honest as a second
-- line of defense and for anything that later reads matching_queue
-- directly under a user's own session.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "matching_select_entry_adm" ON public.matching_queue;
CREATE POLICY "matching_select_reviewers" ON public.matching_queue FOR SELECT
  USING (public.get_my_role() IN ('entry_operator', 'engineer', 'accounts', 'admin'));

DROP POLICY IF EXISTS "matching_update_entry_adm" ON public.matching_queue;
CREATE POLICY "matching_update_reviewers" ON public.matching_queue FOR UPDATE
  USING (public.get_my_role() IN ('entry_operator', 'engineer', 'accounts', 'admin'));

-- matching_insert_admin is left as admin-only: that policy governs the
-- system creating a new queue row during matching, not a human review
-- decision, and is out of scope for D-7.


-- ------------------------------------------------------------
-- Verification queries — run after the statements above and check the
-- output looks right, then report back.
-- ------------------------------------------------------------
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('profiles', 'matching_queue')
ORDER BY tablename, policyname;

SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated');
-- Expect: zero rows.
