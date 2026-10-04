-- Production hardening: performance-safe RLS, missing FK indexes, extension schema,
-- AI runtime health metrics, and a super-admin system health endpoint.

CREATE INDEX IF NOT EXISTS idx_ai_settings_updated_by
  ON public.ai_settings(updated_by);

CREATE INDEX IF NOT EXISTS idx_policies_split_from_policy_id
  ON public.policies(split_from_policy_id);

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_update_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_update_own
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS ai_settings_super_admin_only ON public.ai_settings;
CREATE POLICY ai_settings_super_admin_only
  ON public.ai_settings FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS ai_providers_super_admin_only ON public.ai_providers;
CREATE POLICY ai_providers_super_admin_only
  ON public.ai_providers FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS ai_provider_models_super_admin_only ON public.ai_provider_models;
CREATE POLICY ai_provider_models_super_admin_only
  ON public.ai_provider_models FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin()))
  WITH CHECK ((SELECT public.is_super_admin()));

DROP POLICY IF EXISTS year2_payments_insert_hierarchy ON public.year2_payments;
CREATE POLICY year2_payments_insert_hierarchy
  ON public.year2_payments FOR INSERT TO authenticated
  WITH CHECK (
    paid_by_user_id = (SELECT auth.uid())
    AND policy_id IN (
      SELECT p.id
      FROM public.policies p
      WHERE p.owner_id IN (
        SELECT unnest(public.get_user_subtree((SELECT auth.uid())))
      )
    )
  );

-- This policy was always FALSE and therefore never granted any additional access.
DROP POLICY IF EXISTS notifications_insert_system ON public.notifications;

DO $$
DECLARE
  v_schema text;
BEGIN
  SELECT n.nspname INTO v_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF v_schema = 'public' THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ai_provider_runtime_stats (
  provider text PRIMARY KEY REFERENCES public.ai_providers(provider) ON DELETE CASCADE,
  success_count bigint NOT NULL DEFAULT 0,
  failure_count bigint NOT NULL DEFAULT 0,
  consecutive_failures integer NOT NULL DEFAULT 0,
  avg_latency_ms numeric(12,2),
  last_latency_ms integer,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  cooldown_until timestamptz,
  last_runtime_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_provider_runtime_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_provider_runtime_stats FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_provider_runtime_stats TO service_role;


CREATE OR REPLACE FUNCTION public.record_ai_provider_runtime(
  p_provider text,
  p_success boolean,
  p_latency_ms integer DEFAULT NULL,
  p_error text DEFAULT NULL,
  p_cooldown_seconds integer DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
  INSERT INTO public.ai_provider_runtime_stats (
    provider,
    success_count,
    failure_count,
    consecutive_failures,
    avg_latency_ms,
    last_latency_ms,
    last_success_at,
    last_failure_at,
    cooldown_until,
    last_runtime_error,
    updated_at
  )
  VALUES (
    p_provider,
    CASE WHEN p_success THEN 1 ELSE 0 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    CASE WHEN p_success THEN 0 ELSE 1 END,
    p_latency_ms,
    p_latency_ms,
    CASE WHEN p_success THEN now() ELSE NULL END,
    CASE WHEN p_success THEN NULL ELSE now() END,
    CASE WHEN p_success OR p_cooldown_seconds <= 0 THEN NULL ELSE now() + make_interval(secs => p_cooldown_seconds) END,
    CASE WHEN p_success THEN NULL ELSE left(p_error, 500) END,
    now()
  )
  ON CONFLICT (provider) DO UPDATE SET
    success_count = public.ai_provider_runtime_stats.success_count + CASE WHEN p_success THEN 1 ELSE 0 END,
    failure_count = public.ai_provider_runtime_stats.failure_count + CASE WHEN p_success THEN 0 ELSE 1 END,
    consecutive_failures = CASE
      WHEN p_success THEN 0
      ELSE public.ai_provider_runtime_stats.consecutive_failures + 1
    END,
    avg_latency_ms = CASE
      WHEN p_latency_ms IS NULL THEN public.ai_provider_runtime_stats.avg_latency_ms
      WHEN public.ai_provider_runtime_stats.avg_latency_ms IS NULL THEN p_latency_ms
      ELSE round((public.ai_provider_runtime_stats.avg_latency_ms * 0.8) + (p_latency_ms * 0.2), 2)
    END,
    last_latency_ms = COALESCE(p_latency_ms, public.ai_provider_runtime_stats.last_latency_ms),
    last_success_at = CASE WHEN p_success THEN now() ELSE public.ai_provider_runtime_stats.last_success_at END,
    last_failure_at = CASE WHEN p_success THEN public.ai_provider_runtime_stats.last_failure_at ELSE now() END,
    cooldown_until = CASE
      WHEN p_success THEN NULL
      WHEN p_cooldown_seconds > 0 THEN now() + make_interval(secs => p_cooldown_seconds)
      ELSE public.ai_provider_runtime_stats.cooldown_until
    END,
    last_runtime_error = CASE WHEN p_success THEN NULL ELSE left(p_error, 500) END,
    updated_at = now();
END;
$;

REVOKE ALL ON FUNCTION public.record_ai_provider_runtime(text, boolean, integer, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_provider_runtime(text, boolean, integer, text, integer)
  TO service_role;

CREATE OR REPLACE FUNCTION public.get_system_health()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'غير مصرح: هذه الصفحة للمشرف الأعلى فقط';
  END IF;

  SELECT jsonb_build_object(
    'checked_at', now(),
    'database', jsonb_build_object(
      'status', 'healthy',
      'server_time', now()
    ),
    'ai', jsonb_build_object(
      'enabled', COALESCE((SELECT ai_enabled FROM public.ai_settings LIMIT 1), false),
      'models_updated_at', (SELECT models_updated_at FROM public.ai_settings LIMIT 1),
      'providers', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'provider', p.provider,
            'display_name', p.display_name,
            'provider_type', p.provider_type,
            'enabled', p.enabled,
            'priority', p.priority,
            'status', p.status,
            'default_model', p.default_model,
            'last_tested_at', p.last_tested_at,
            'last_error', p.last_error,
            'model_count', (SELECT count(*) FROM public.ai_provider_models m WHERE m.provider = p.provider),
            'runtime', jsonb_build_object(
              'success_count', COALESCE(s.success_count, 0),
              'failure_count', COALESCE(s.failure_count, 0),
              'consecutive_failures', COALESCE(s.consecutive_failures, 0),
              'avg_latency_ms', s.avg_latency_ms,
              'last_latency_ms', s.last_latency_ms,
              'last_success_at', s.last_success_at,
              'last_failure_at', s.last_failure_at,
              'cooldown_until', s.cooldown_until,
              'last_error', s.last_runtime_error
            )
          )
          ORDER BY p.provider_type, p.priority
        )
        FROM public.ai_providers p
        LEFT JOIN public.ai_provider_runtime_stats s ON s.provider = p.provider
      ), '[]'::jsonb)
    ),
    'cron', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'jobid', j.jobid,
          'jobname', j.jobname,
          'schedule', j.schedule,
          'active', j.active,
          'last_run', (
            SELECT jsonb_build_object(
              'status', d.status,
              'start_time', d.start_time,
              'end_time', d.end_time,
              'return_message', left(COALESCE(d.return_message, ''), 300)
            )
            FROM cron.job_run_details d
            WHERE d.jobid = j.jobid
            ORDER BY d.start_time DESC
            LIMIT 1
          )
        )
        ORDER BY j.jobid
      )
      FROM cron.job j
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_system_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_system_health() TO authenticated, service_role;
